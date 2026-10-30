#!/usr/bin/env python3
"""Export the verified fmsave oracle to a JSON file for Rust comparison.

This is a development tool. It is not shipped with the app.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
from datetime import date
from enum import IntEnum
from pathlib import Path

import fmsave

DEFAULT_SAVE = (
    Path.home()
    / "Library/Application Support/Sports Interactive/Football Manager 27/games"
    / "BB KING - Casciavit.fm"
)


def jsonable(value):
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, IntEnum):
        return int(value)
    if dataclasses.is_dataclass(value):
        return {field.name: jsonable(getattr(value, field.name)) for field in dataclasses.fields(value)}
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(item) for item in value]
    return value


def player_row(player: fmsave.Player) -> dict:
    contract = player.contract
    return {
        "uid": player.uid,
        "unique_id": player.unique_id,
        "name": player.name,
        "first_name": player.first_name,
        "last_name": player.last_name,
        "common_name": player.common_name,
        "full_name": player.full_name,
        "legal_name": player.legal_name,
        "birth_date": jsonable(player.birth_date),
        "age": player.age,
        "nation_id": player.nation_id,
        "second_nation_ids": list(player.second_nation_ids),
        "home_grown_nation_ids": list(player.home_grown_nation_ids),
        "home_grown_club_uids": list(player.home_grown_club_uids),
        "home_grown_club_names": list(player.home_grown_club_names),
        "height_cm": player.height_cm,
        "ca": player.ability.current,
        "pa": player.ability.potential,
        "pa_range_code": player.ability.potential_range_code,
        "reputation": jsonable(player.reputation),
        "club_uid": player.club_uid,
        "club_name": player.club_name,
        "club_short_name": player.club_short_name,
        "club_nation_id": player.club_nation_id,
        "club_fa_nation_id": player.club_fa_nation_id,
        "club_reputation": player.club_reputation,
        "club_last_league_position": player.club_last_league_position,
        "team_id": player.team_id,
        "team_slot": player.team_slot,
        "club_join_date": jsonable(player.club_join_date),
        "natural_positions": list(player.natural_positions),
        "accomplished_positions": list(player.accomplished_positions),
        "personality": jsonable(player.personality),
        "attributes": jsonable(player.attributes),
        "raw_attributes": jsonable(player.raw_attributes),
        "left_foot": player.left_foot,
        "right_foot": player.right_foot,
        "raw_left_foot": player.raw_left_foot,
        "raw_right_foot": player.raw_right_foot,
        "positions": jsonable(player.positions),
        "transfer_value": player.transfer_value,
        "transfer_value_state": jsonable(player.transfer_value_state),
        "raw_condition": player.raw_condition,
        "raw_match_sharpness": player.raw_match_sharpness,
        "trait_bits": player.trait_bits,
        "traits": [{"bit": trait.raw, "name": None} for trait in player.traits],
        "on_loan": player.on_loan,
        "loan_parent_club_uid": player.loan_parent_club_uid,
        "loan_start": jsonable(player.loan_start),
        "loan_end": jsonable(player.loan_end),
        "contract": None
        if contract is None
        else {
            "club_uid": contract.club_uid,
            "club_name": contract.club_name,
            "team_id": contract.team_id,
            "wage": contract.wage,
            "start": jsonable(contract.start),
            "end": jsonable(contract.end),
            "squad_status": None if contract.squad_status is None else contract.squad_status.raw,
            "contract_type": None if contract.kind is None else contract.kind.raw,
            "on_loan": contract.on_loan,
            "loan_parent_club_uid": contract.loan_parent_club_uid,
            "loan_parent_club_name": contract.loan_parent_club_name,
            "loan_start": jsonable(contract.loan_start),
            "loan_end": jsonable(contract.loan_end),
            "clauses": [
                {
                    "kind": clause.kind.raw,
                    "parameter": clause.parameter,
                    "value": clause.value,
                }
                for clause in contract.clauses
            ],
            "chain": [
                {
                    "club_uid": entry.club_uid,
                    "club_name": entry.club_name,
                    "team_id": entry.team_id,
                    "wage": entry.wage,
                    "start": jsonable(entry.start),
                    "end": jsonable(entry.end),
                    "has_terms": entry.has_terms,
                }
                for entry in contract.chain
            ],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("save", nargs="?", default=str(DEFAULT_SAVE))
    parser.add_argument("--output", default="fixtures/oracle_players.json")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    save = fmsave.open(args.save, experimental_fm27=True)
    players = save.players()
    if args.limit:
        players = players[: args.limit]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        json.dump([player_row(player) for player in players], handle, ensure_ascii=False)
    print(f"wrote {len(players)} players to {output}")


if __name__ == "__main__":
    main()
