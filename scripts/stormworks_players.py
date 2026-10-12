#!/usr/bin/env python3
"""Poll the local Stormworks A2S_INFO endpoint and publish /players.json."""
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


def read_cstring(packet, offset):
    end = packet.index(b"\x00", offset)
    return packet[offset:end].decode("utf-8", errors="replace"), end + 1


def query_server():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(3)
        sock.sendto(REQUEST, (HOST, PORT))
        packet, _ = sock.recvfrom(4096)

    if len(packet) < 57 or packet[:6] != b"\xff\xff\xff\xffI\x11":
        raise ValueError("Unexpected A2S_INFO response")

    offset = 6
    name, offset = read_cstring(packet, offset)
    map_name, offset = read_cstring(packet, offset)
    folder, offset = read_cstring(packet, offset)
    game, offset = read_cstring(packet, offset)

    # The observed Stormworks response has a 2-byte app ID, then
    # player count, maximum players, and bots. Validate bounds first.
    if offset + 5 > len(packet):
        raise ValueError("Response ended before player fields")
    app_id = int.from_bytes(packet[offset:offset + 2], "little")
    players, maximum, bots = packet[offset + 2:offset + 5]

    return {
        "online": True,
        "serverName": name,
        "players": players,
        "maxPlayers": maximum,
        "bots": bots,
        "map": map_name,
        "game": game,
        "appId": app_id,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }


def publish(data):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=".players-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle)
            handle.write("\n")
        os.chmod(temp_path, 0o644)
        os.replace(temp_path, OUTPUT)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main():
    while True:
        try:
            data = query_server()
        except Exception as exc:
            data = {
                "online": False,
                "serverName": None,
                "players": None,
                "maxPlayers": None,
                "error": type(exc).__name__,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        publish(data)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
