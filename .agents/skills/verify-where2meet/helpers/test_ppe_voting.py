import copy
from pathlib import Path
import re
import unittest
from unittest.mock import patch

import ppe


EVENT_ID = "evt_1760000000000_0123456789abcdef"
OTHER_EVENT = "evt_1760000000001_abcdef0123456789"
ORGANIZER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
GUEST = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
FOREIGN_PARTICIPANT = "cccccccc-cccc-cccc-cccc-cccccccccccc"
PLACE_ID = "ChIJ2eUgeAKp3YARbn5u_wAGqB4"
OTHER_PLACE = "ChIJRUKHCsyp3YARdrGiTZBwbQw"
BACKEND = "https://ppe.example.test"


def voting_state():
    return {
        "run_id": "12345678abcdef", "scenario": "voting-publication", "backend_url": BACKEND,
        "owned_events": [{"event_id": EVENT_ID, "organizer_id": ORGANIZER,
                          "participant_ids": [GUEST], "cleanup_state": "pending"}],
        "provider_place_ids": [PLACE_ID],
    }


def vote_body():
    return {"venueId": PLACE_ID, "venueData": {"name": "Fixture cafe", "lat": 32.71, "lng": -117.15}}


class VotingRequestBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.state = voting_state()
        self.event_path = "/api/events/" + EVENT_ID
        self.votes = self.event_path + "/participants/" + ORGANIZER + "/votes"
        self.publish = self.event_path + "/publish"

    def authorize(self, method, path, body=None, purpose="ui", state=None):
        return ppe.authorize_request(self.state if state is None else state, method, BACKEND + path, body, purpose)

    def test_only_organizer_and_recorded_guest_can_vote_for_observed_places(self):
        for participant in (ORGANIZER, GUEST):
            path = self.votes.replace(ORGANIZER, participant)
            self.authorize("POST", path, vote_body())
            self.authorize("DELETE", path + "/" + PLACE_ID)
            self.authorize("OPTIONS", path)
        for path in (self.votes.replace(ORGANIZER, FOREIGN_PARTICIPANT), self.votes.replace(EVENT_ID, OTHER_EVENT),
                     self.votes.replace(ORGANIZER, "not-a-uuid"), self.event_path + "/votes", self.votes + "/extra/path"):
            for method, suffix, body in (("POST", "", vote_body()), ("DELETE", "/" + PLACE_ID, None)):
                with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                    self.authorize(method, path + suffix, body)
        for method, path, body in (("POST", self.votes, {**vote_body(), "venueId": OTHER_PLACE}),
                                   ("DELETE", self.votes + "/" + OTHER_PLACE, None),
                                   ("POST", self.publish, {"venueId": OTHER_PLACE})):
            with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                self.authorize(method, path, body)

    def test_vote_and_publication_writes_require_browser_ui_purpose(self):
        operations = [("POST", self.votes, vote_body()), ("DELETE", self.votes + "/" + PLACE_ID, None),
                      ("POST", self.publish, {"venueId": PLACE_ID}), ("DELETE", self.publish, None)]
        for method, path, body in operations:
            self.authorize(method, path, body)
            for purpose in ("negative", "cleanup", "", None):
                with self.subTest(method=method, path=path, purpose=purpose), self.assertRaises(RuntimeError):
                    self.authorize(method, path, body, purpose=purpose)

    def test_missing_deleted_or_unrecorded_ownership_rejects_mutations(self):
        self.authorize("POST", self.votes, vote_body())
        for change in ({"owned_events": []}, {"provider_place_ids": []},
                       {"owned_events": [*self.state["owned_events"], {**self.state["owned_events"][0], "event_id": OTHER_EVENT}]},
                       {"owned_events": [{**self.state["owned_events"][0], "cleanup_state": "deleted"}]}):
            for path, body in ((self.votes, vote_body()), (self.publish, {"venueId": PLACE_ID})):
                with self.subTest(change=change, path=path), self.assertRaises(RuntimeError):
                    self.authorize("POST", path, body, state={**self.state, **change})
        state = copy.deepcopy(self.state)
        state["owned_events"][0]["participant_ids"] = []
        with self.assertRaises(RuntimeError):
            self.authorize("POST", self.votes.replace(ORGANIZER, GUEST), vote_body(), state=state)

    def test_voting_setup_keeps_m3_participant_mutation_limits(self):
        organizer = self.event_path + "/participants/" + ORGANIZER
        guest = {"name": "Verification guest", "address": "San Diego Central Library", "fuzzyLocation": False}
        self.authorize("PATCH", organizer, {"name": "Verification organizer", "fuzzyLocation": True})
        state = copy.deepcopy(self.state)
        state["owned_events"][0]["participant_ids"] = []
        self.authorize("POST", self.event_path + "/participants", guest, state=state)
        for method, path, body in (("POST", self.event_path + "/participants", guest),
                                   ("PATCH", organizer.replace(ORGANIZER, GUEST), {"name": "Changed guest"}),
                                   ("DELETE", organizer.replace(ORGANIZER, GUEST), None),
                                   ("PATCH", organizer, {"isOrganizer": True}),
                                   ("PATCH", organizer, {"tokenHash": "fixture-only"})):
            with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                self.authorize(method, path, body)

    def test_vote_body_requires_exact_outer_keys_and_required_metadata(self):
        self.authorize("POST", self.votes, vote_body())
        invalid = [None, [], {}, {"venueId": PLACE_ID}, {"venueData": vote_body()["venueData"]},
                   {**vote_body(), "participantId": ORGANIZER}, {**vote_body(), "tokenHash": "fixture-only"},
                   {**vote_body(), "venueId": None}, {**vote_body(), "venueId": [PLACE_ID]},
                   {**vote_body(), "venueData": None}, {**vote_body(), "venueData": []},
                   {**vote_body(), "venueData": {**vote_body()["venueData"], "id": PLACE_ID}}]
        invalid.extend({**vote_body(), "venueData": {key: value for key, value in vote_body()["venueData"].items() if key != missing}}
                       for missing in ("name", "lat", "lng"))
        for body in invalid:
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                self.authorize("POST", self.votes, body)

    def test_vote_metadata_bounds_reject_nonfinite_boolean_and_wrong_types(self):
        bounds = {"name": ("x", "x" * 255), "lat": (-90, 90), "lng": (-180, 180),
                  "address": ("", "x" * 255, None), "category": ("", "x" * 50, None),
                  "rating": (0, 5, None), "priceLevel": (0, 4, None)}
        for field, values in bounds.items():
            for value in values:
                self.authorize("POST", self.votes, {**vote_body(), "venueData": {**vote_body()["venueData"], field: value}})
        invalid = {"name": (None, "", "x" * 256, True, 1), "lat": (-90.1, 90.1), "lng": (-180.1, 180.1),
                   "address": ("x" * 256, True, 1, []), "category": ("x" * 51, True, 1, []),
                   "rating": (-0.1, 5.1), "priceLevel": (-1, 5, 1.5, True, "2")}
        for field in ("lat", "lng", "rating"):
            invalid[field] += (True, False, "1", [], float("nan"), float("inf"), -float("inf"), 10 ** 400)
        for field in ("lat", "lng"):
            invalid[field] += (None,)
        for field, values in invalid.items():
            for value in values:
                with self.subTest(field=field, value=value), self.assertRaises(RuntimeError):
                    self.authorize("POST", self.votes, {**vote_body(), "venueData": {**vote_body()["venueData"], field: value}})

    def test_vote_photo_is_only_the_exact_observed_owned_endpoint(self):
        photo = BACKEND + "/api/venues/" + PLACE_ID + "/photo"
        for value in (photo, None):
            self.authorize("POST", self.votes, {**vote_body(), "venueData": {**vote_body()["venueData"], "photoUrl": value}})
        for value in ("", 1, [], photo + "?key=fixture-only", photo + "#fragment", photo + "/", photo.replace(PLACE_ID, OTHER_PLACE),
                      photo.replace("https:", "http:"), photo.replace("ppe.example.test", "outside.example.test"),
                      "https://lh3.googleusercontent.com/image", "https://maps.googleapis.com/photo?key=fixture-only"):
            with self.subTest(photo=value), self.assertRaises(RuntimeError):
                self.authorize("POST", self.votes, {**vote_body(), "venueData": {**vote_body()["venueData"], "photoUrl": value}})

    def test_publication_accepts_only_observed_venue_id_and_reopen_has_no_body(self):
        self.authorize("POST", self.publish, {"venueId": PLACE_ID})
        self.authorize("DELETE", self.publish)
        for body in (None, [], {}, {"venueId": None}, {"venueId": PLACE_ID, "publishedAt": "now"}, vote_body()):
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                self.authorize("POST", self.publish, body)
        for path in (self.publish, self.votes + "/" + PLACE_ID):
            for body in ({}, [], "", {"venueId": PLACE_ID}):
                with self.subTest(path=path, body=body), self.assertRaises(RuntimeError):
                    self.authorize("DELETE", path, body)
        for method, path in (("PATCH", self.publish), ("PUT", self.votes), ("POST", self.votes + "/" + PLACE_ID),
                             ("DELETE", self.votes), ("GET", self.votes), ("GET", self.publish)):
            with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                self.authorize(method, path, vote_body())

    def test_statistics_read_and_m3_provider_reads_stay_owned_and_bounded(self):
        statistics = self.event_path + "/votes/statistics"
        self.authorize("GET", statistics)
        self.authorize("POST", "/api/venues/search", {"center": {"lat": 32.71, "lng": -117.15}, "searchRadius": 1000, "query": "coffee"})
        for path in (self.event_path, self.event_path + "/me", self.event_path + "/stream", self.event_path + "/votes",
                     "/api/venues/" + PLACE_ID, "/api/venues/" + PLACE_ID + "/photo",
                     self.event_path + "/venues/" + PLACE_ID + "/directions?travelMode=walking"):
            self.authorize("GET", path)
        for method, path, body in (("POST", statistics, {}), ("DELETE", statistics, None), ("GET", statistics, {}),
                                   ("GET", statistics.replace(EVENT_ID, OTHER_EVENT), None),
                                   ("GET", "/api/venues/" + OTHER_PLACE, None),
                                   ("GET", self.event_path + "/venues/" + PLACE_ID + "/directions?travelMode=transit", None)):
            with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                self.authorize(method, path, body)
        for events in ([], [*self.state["owned_events"], {**self.state["owned_events"][0], "event_id": OTHER_EVENT}],
                       [{**self.state["owned_events"][0], "cleanup_state": "deleted"}]):
            with self.subTest(events=events), self.assertRaises(RuntimeError):
                self.authorize("GET", statistics, state={**self.state, "owned_events": events})

    def test_paths_queries_fragments_and_foreign_origins_cannot_expand_authority(self):
        self.authorize("POST", self.votes, vote_body())
        for path, method, body in ((self.votes, "POST", vote_body()), (self.publish, "POST", {"venueId": PLACE_ID}),
                                   (self.votes + "/" + PLACE_ID, "DELETE", None), (self.event_path + "/votes/statistics", "GET", None)):
            for suffix in ("?extra=1", "?venueId=" + PLACE_ID, "#fragment", "/extra", "%2Fextra"):
                with self.subTest(path=path, suffix=suffix), self.assertRaises(RuntimeError):
                    self.authorize(method, path + suffix, body)
            with self.subTest(path=path), self.assertRaises(RuntimeError):
                ppe.authorize_request(self.state, method, "https://outside.example.test" + path, body, "ui")
        for scenario in ("places-routes", "participants", "lifecycle"):
            for path, body in ((self.votes, vote_body()), (self.publish, {"venueId": PLACE_ID})):
                with self.subTest(scenario=scenario, path=path), self.assertRaises(RuntimeError):
                    self.authorize("POST", path, body, state={**self.state, "scenario": scenario})


class VotingProjectionAndCleanupTest(unittest.TestCase):
    def test_observation_uses_exact_owned_readonly_projection_without_credentials(self):
        captured = []

        def database(_run, _state, sql):
            captured.append(sql)
            return {"event": {"id": EVENT_ID, "published_venue_id": PLACE_ID}, "participants": [],
                    "votes": [{"id": "vote-fixture", "event_id": EVENT_ID, "participant_id": GUEST, "venue_id": PLACE_ID}]}

        with patch.object(ppe, "run_database", side_effect=database):
            result = ppe.observe_event(Path("/unused-voting-run"), voting_state(), EVENT_ID)
            self.assertEqual(result["votes"], [{"id": "vote-fixture", "event_id": EVENT_ID, "participant_id": GUEST, "venue_id": PLACE_ID}])
            self.assertEqual(result["event"]["published_venue_id"], PLACE_ID)
            with self.assertRaises(RuntimeError):
                ppe.observe_event(Path("/unused-voting-run"), voting_state(), OTHER_EVENT)
        self.assertEqual(len(captured), 1)
        sql = " ".join(captured[0].split())
        self.assertTrue(sql.startswith("BEGIN READ ONLY; SELECT json_build_object("))
        self.assertTrue(sql.endswith("COMMIT;"))
        self.assertIn("SELECT id, title, meeting_time, published_at, published_venue_id FROM event WHERE id = '" + EVENT_ID + "'", sql)
        self.assertIn("SELECT id, event_id, participant_id, venue_id FROM vote WHERE event_id = '" + EVENT_ID + "' ORDER BY id", sql)
        self.assertEqual(re.findall(r"WHERE (?:event_)?id = '([^']+)'", sql), [EVENT_ID, EVENT_ID, EVENT_ID])
        projected = sql.replace("token_hash IS NOT NULL AS has_credential", "has_credential")
        self.assertNotRegex(projected, r"\b(?:token_hash|token|password_hash|session_token|credential|authorization)\b|SELECT \*")

    def test_cleanup_requires_exact_absence_of_event_participants_and_votes(self):
        empty = {"event": None, "participants": [], "votes": []}
        invalid = [{"event": None, "participants": []}, {**empty, "votes": [{"id": "remaining-vote"}]},
                   {**empty, "participants": [{"id": GUEST}]}, {**empty, "event": {"id": EVENT_ID}},
                   {**empty, "extra": "unreviewed"}]
        for snapshot in invalid + [empty]:
            state = voting_state()
            saved = []
            with patch.object(ppe, "read_run", return_value=state), patch.object(ppe, "observe_event", return_value=snapshot), \
                    patch.object(ppe.control, "save", side_effect=lambda _run, value: saved.append(copy.deepcopy(value))):
                if snapshot == empty:
                    self.assertEqual(ppe.bridge(Path("/unused-voting-run"), {"operation": "closed", "event_id": EVENT_ID}), {"deleted": EVENT_ID})
                    self.assertEqual(saved[0]["owned_events"][0]["cleanup_state"], "deleted")
                else:
                    with self.subTest(snapshot=snapshot), self.assertRaisesRegex(RuntimeError, "rows still exist"):
                        ppe.bridge(Path("/unused-voting-run"), {"operation": "closed", "event_id": EVENT_ID})
                    self.assertEqual(state["owned_events"][0]["cleanup_state"], "pending")
                    self.assertEqual(saved, [])

    def test_provider_and_guest_receipts_remain_bounded_in_voting_scenario(self):
        state = voting_state()
        state["owned_events"][0]["participant_ids"] = []
        run = Path("/unused-voting-run")
        with patch.object(ppe, "read_run", return_value=state), patch.object(ppe.control, "save"):
            participant = {"operation": "record-participant", "event_id": EVENT_ID, "participant_id": GUEST}
            self.assertEqual(ppe.bridge(run, participant), {"recorded": GUEST})
            self.assertEqual(ppe.bridge(run, participant), {"recorded": GUEST})
            with self.assertRaises(RuntimeError):
                ppe.bridge(run, {**participant, "participant_id": FOREIGN_PARTICIPANT})
            places = {"operation": "record-places", "body": {"venues": [{"id": OTHER_PLACE}], "totalResults": 1,
                                                                "searchCenter": {"lat": 32.71, "lng": -117.15}}}
            self.assertEqual(ppe.bridge(run, places), {"recorded": [OTHER_PLACE]})
            self.assertEqual(state["provider_place_ids"], [PLACE_ID, OTHER_PLACE])
            with self.assertRaises(RuntimeError):
                ppe.bridge(run, {**places, "body": {**places["body"], "totalResults": 2}})
            self.assertEqual(state["provider_place_ids"], [PLACE_ID, OTHER_PLACE])


if __name__ == "__main__":
    unittest.main()
