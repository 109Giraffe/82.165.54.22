#!/usr/bin/env python3
"""Publish Stormworks A2S_INFO details to a separate public JSON file.

Run on the Stormworks VPS. This script only sends a local UDP query to
127.0.0.1:25565 and writes /var/www/html/players.json; it never touches
the existing status.json monitor feed.
"""
import json
import os
import socket
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

HOST = "127.0.0.1"
PORT = 25565
OUTPUT = Path("/var/www/html/players.json")
INTERVAL_SECONDS = 15
REQUEST = b"\xff\xff\xff\xffTSource Engine Query\x00"


def read_cstring(packet: bytes, offset: int) -> tuple[str, int]:
    end = packet.index(b"\x00", offset)
    return packet[offset:end].decode("utf-8", errors="replace"), end + 1


def query_server() -> dict:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(3)
        sock.sendto(REQUEST, (HOST, PORT))
        packet, _ = sock.recvfrom(4096)

    if len(packet) < 57 or packet[:6] != b"\xff\xff\xff\xffI\x11":
        raise ValueError("Unexpected A2S_INFO response")

    offset = 6
    server_name, offset = read_cstring(packet, offset)
    map_name, offset = read_cstring(packet, offset)
    folder, offset = read_cstring(packet, offset)
    game, offset = read_cstring(packet, offset)

    # Stormworks' observed response has a two-byte app ID followed by
    # players, max players and bots. Confirm bounds before reading fields.
    if offset + 5 > len(packet):
        raise ValueError("A2S_INFO response ended before player fields")
    app_id = int.from_bytes(packet[offset:offset + 2], "little")
    players, max_players, bots = packet[offset + 2:offset + 5]

    return {
        "online": True,
        "serverName": server_name,
        "players": players,
        "maxPlayers": max_players,
        "bots": bots,
        "map": map_name,
        "game": game,
        "version": packet[packet.find(b"\x00", offset + 9) + 1:].split(b"\x00", 1)[0].decode("utf-8", errors="replace") if False else None,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }


def write_json(data: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=".players-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(data, file)
            file.write("\n")
        os.chmod(temp_path, 0o644)
        os.replace(temp_path, OUTPUT)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main() -> None:
    while True:
        try:
            data = query_server()
        except Exception as exc:
            data = {
                "online": False,
                "serverName": "TeamAviatorsPrivate",
                "players": None,
                "maxPlayers": None,
                "error": type(exc).__name__,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        write_json(data)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
