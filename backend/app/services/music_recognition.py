"""Chromaprint fingerprint generation and AcoustID metadata lookup."""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx

ACOUSTID_LOOKUP_URL = "https://api.acoustid.org/v2/lookup"


class FingerprintToolMissing(RuntimeError):
    """The Chromaprint fpcalc executable is unavailable."""


class InvalidAudioFile(RuntimeError):
    """The supplied file could not be fingerprinted."""


class FingerprintTimeout(RuntimeError):
    """Fingerprint generation exceeded the time limit."""


class AcoustIDUnavailable(RuntimeError):
    """The AcoustID service could not return a usable response."""


async def generate_fingerprint(
    file_path: str | Path,
    *,
    fpcalc_path: str,
    fingerprint_length_seconds: int = 120,
    timeout_seconds: int = 45,
) -> tuple[int, str]:
    """Run fpcalc off the event loop and return (duration_seconds, fingerprint)."""

    def run_fpcalc() -> tuple[int, str]:
        command = [
            fpcalc_path,
            "-json",
            "-length",
            str(fingerprint_length_seconds),
            str(file_path),
        ]
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
            )
        except FileNotFoundError as exc:
            raise FingerprintToolMissing from exc
        except subprocess.TimeoutExpired as exc:
            raise FingerprintTimeout from exc
        except OSError as exc:
            raise FingerprintToolMissing from exc

        if completed.returncode != 0:
            raise InvalidAudioFile
        try:
            payload = json.loads(completed.stdout)
            duration = int(round(float(payload.get("duration", 0))))
            fingerprint = payload.get("fingerprint")
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            raise InvalidAudioFile from exc
        if duration <= 0 or not isinstance(fingerprint, str) or not fingerprint.strip():
            raise InvalidAudioFile
        return duration, fingerprint

    return await asyncio.to_thread(run_fpcalc)


# AcoustID asks clients not to exceed three requests per second. This in-process
# gate spaces requests from this API worker; production deployments with multiple
# workers should also apply a shared rate limit.
_lookup_lock = asyncio.Lock()
_last_lookup_started = 0.0


async def lookup_acoustid(
    client_key: str,
    fingerprint: str,
    duration_seconds: int,
    *,
    timeout_seconds: float = 12.0,
) -> dict[str, Any]:
    global _last_lookup_started

    async with _lookup_lock:
        now = time.monotonic()
        wait_seconds = 0.36 - (now - _last_lookup_started)
        if _last_lookup_started and wait_seconds > 0:
            await asyncio.sleep(wait_seconds)
        _last_lookup_started = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                ACOUSTID_LOOKUP_URL,
                data={
                    "client": client_key,
                    "duration": str(duration_seconds),
                    "fingerprint": fingerprint,
                    "meta": "recordings+releasegroups+releases+compress",
                    "format": "json",
                },
            )
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise AcoustIDUnavailable from exc

    if response.status_code != 200:
        raise AcoustIDUnavailable
    try:
        payload = response.json()
    except ValueError as exc:
        raise AcoustIDUnavailable from exc
    if not isinstance(payload, dict) or payload.get("status") != "ok":
        raise AcoustIDUnavailable
    return payload


def parse_acoustid_matches(payload: dict[str, Any], *, limit: int = 5) -> list[dict[str, Any]]:
    """Normalize AcoustID results into small, display-ready recording records."""
    normalized: dict[str, dict[str, Any]] = {}

    for match in payload.get("results") or []:
        if not isinstance(match, dict):
            continue
        try:
            score = max(0.0, min(1.0, float(match.get("score", 0))))
        except (TypeError, ValueError):
            score = 0.0

        acoustid_id = match.get("id") if isinstance(match.get("id"), str) else None
        for recording in match.get("recordings") or []:
            if not isinstance(recording, dict):
                continue
            title = recording.get("title")
            if not isinstance(title, str) or not title.strip():
                continue

            artists = [
                artist["name"].strip()
                for artist in recording.get("artists") or []
                if isinstance(artist, dict)
                and isinstance(artist.get("name"), str)
                and artist["name"].strip()
            ]
            releases = recording.get("releases") or []
            release_groups = recording.get("releasegroups") or []
            first_release = releases[0] if releases and isinstance(releases[0], dict) else {}
            first_group = release_groups[0] if release_groups and isinstance(release_groups[0], dict) else {}
            album = first_release.get("title") or first_group.get("title")
            release_date = first_release.get("date") or first_group.get("firstreleasedate")
            year_match = re.match(r"^(\d{4})", release_date) if isinstance(release_date, str) else None
            recording_id = recording.get("id") if isinstance(recording.get("id"), str) else None
            identity = recording_id or f"{title.casefold()}|{'|'.join(artists).casefold()}"

            item = {
                "title": title.strip(),
                "artists": artists,
                "album": album if isinstance(album, str) and album.strip() else None,
                "year": int(year_match.group(1)) if year_match else None,
                "score": score,
                "acoustid_id": acoustid_id,
                "musicbrainz_recording_id": recording_id,
                "musicbrainz_url": f"https://musicbrainz.org/recording/{recording_id}" if recording_id else None,
                "acoustid_url": f"https://acoustid.org/track/{acoustid_id}" if acoustid_id else None,
            }
            existing = normalized.get(identity)
            if existing is None or score > existing["score"]:
                normalized[identity] = item

    return sorted(normalized.values(), key=lambda item: item["score"], reverse=True)[:limit]
