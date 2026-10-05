import copy
from pathlib import Path
import unittest
from unittest.mock import patch

import ppe


PLACE_ID = "ChIJ2eUgeAKp3YARbn5u_wAGqB4"
SECOND_PLACE_ID = "ChIJRUKHCsyp3YARdrGiTZBwbQw"


def places_state():
    return {
        "run_id": "12345678abcdef",
        "scenario": "places-routes",
        "backend_url": "https://ppe.example.test",
        "owned_events": [{
            "event_id": "evt_1760000000000_0123456789abcdef",
            "organizer_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "cleanup_state": "pending",
            "participant_ids": [],
        }],
        "provider_place_ids": [PLACE_ID],
    }


def search_response(*place_ids):
    return {
        "venues": [{"id": place_id, "name": "Fixture coffee shop"} for place_id in place_ids],
        "totalResults": len(place_ids),
        "searchCenter": {"lat": 32.71, "lng": -117.15},
    }


class PlacesRequestBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.state = places_state()
        self.entry = self.state["owned_events"][0]
        self.event_path = "/api/events/" + self.entry["event_id"]
        self.search = {"center": {"lat": 32.71, "lng": -117.15}, "searchRadius": 1000, "query": "coffee"}

    def authorize(self, method, path, body=None, purpose="ui", state=None):
        selected = self.state if state is None else state
        return ppe.authorize_request(selected, method, selected["backend_url"] + path, body, purpose)

    def test_search_requires_ui_and_a_pending_owned_event(self):
        self.authorize("POST", "/api/venues/search", self.search)
        for purpose in ("negative", "cleanup", ""):
            with self.subTest(purpose=purpose), self.assertRaises(RuntimeError):
                self.authorize("POST", "/api/venues/search", self.search, purpose=purpose)
        for events in ([], [{**self.entry, "cleanup_state": "deleted"}]):
            state = {**self.state, "owned_events": events}
            with self.subTest(events=events), self.assertRaises(RuntimeError):
                self.authorize("POST", "/api/venues/search", self.search, state=state)

    def test_search_body_has_exact_keys_and_fixed_query(self):
        invalid = [None, [], {}, {**self.search, "query": "bars"}, {**self.search, "query": "Coffee"},
                   {**self.search, "query": ["coffee"]}, {**self.search, "apiKey": "fixture-only"}]
        invalid.extend({key: value for key, value in self.search.items() if key != missing}
                       for missing in self.search)
        self.authorize("POST", "/api/venues/search", self.search)
        for body in invalid:
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                self.authorize("POST", "/api/venues/search", body)

    def test_search_coordinates_are_finite_numbers_in_geographic_range(self):
        for center in ({"lat": -90, "lng": -180}, {"lat": 90, "lng": 180}):
            self.authorize("POST", "/api/venues/search", {**self.search, "center": center})
        invalid = [None, [], {}, {"lat": 32.71}, {"lng": -117.15}, {"lat": 32.71, "lng": -117.15, "radius": 1000}]
        for coordinate, values in (("lat", [-90.01, 90.01]), ("lng", [-180.01, 180.01])):
            invalid.extend({**self.search["center"], coordinate: value} for value in values)
        for coordinate in ("lat", "lng"):
            invalid.extend({**self.search["center"], coordinate: value}
                           for value in (True, False, "32.71", None, 10 ** 400, float("nan"), float("inf"), -float("inf")))
        for center in invalid:
            with self.subTest(center=center), self.assertRaises(RuntimeError):
                self.authorize("POST", "/api/venues/search", {**self.search, "center": center})

    def test_search_radius_has_inclusive_numeric_limits(self):
        for radius in (100, 50000):
            self.authorize("POST", "/api/venues/search", {**self.search, "searchRadius": radius})
        for radius in (99, 50001, True, False, "1000", None, 10 ** 400, float("nan"), float("inf"), -float("inf")):
            with self.subTest(radius=radius), self.assertRaises(RuntimeError):
                self.authorize("POST", "/api/venues/search", {**self.search, "searchRadius": radius})

    def test_venue_reads_require_recorded_ids_and_exact_paths(self):
        for method in ("GET", "HEAD"):
            for suffix in ("", "/photo"):
                self.authorize(method, "/api/venues/" + PLACE_ID + suffix)
                with self.subTest(method=method, suffix=suffix), self.assertRaises(RuntimeError):
                    self.authorize(method, "/api/venues/" + SECOND_PLACE_ID + suffix)
            for path in ("/api/venues", "/api/venues/search", "/api/venues/" + PLACE_ID + "/reviews",
                         "/api/venues/" + PLACE_ID + "/photo/extra", "/api/venues/../events"):
                with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                    self.authorize(method, path)

    def test_venue_requests_reject_unapproved_methods_and_url_changes(self):
        self.authorize("GET", "/api/venues/" + PLACE_ID)
        for method in ("POST", "PATCH", "DELETE"):
            for suffix in ("", "/photo"):
                with self.subTest(method=method, suffix=suffix), self.assertRaises(RuntimeError):
                    self.authorize(method, "/api/venues/" + PLACE_ID + suffix, {})
        for path in ("/api/venues/" + PLACE_ID + "?token=fixture-only",
                     "/api/venues/" + PLACE_ID + "#fragment",
                     "/api/venues/" + PLACE_ID + "%2Fphoto"):
            with self.subTest(path=path), self.assertRaises(RuntimeError):
                self.authorize("GET", path)
        with self.assertRaises(RuntimeError):
            ppe.authorize_request(self.state, "GET", "https://other.example.test/api/venues/" + PLACE_ID, None, "ui")

    def test_directions_accept_only_driving_and_walking_for_the_owned_event(self):
        path = self.event_path + "/venues/" + PLACE_ID + "/directions"
        for mode in ("driving", "walking"):
            self.authorize("GET", path + "?travelMode=" + mode)
        for query in ("", "?travelMode=transit", "?travelMode=bicycling", "?travelMode=DRIVING",
                      "?travelMode=", "?travelMode=driving&travelMode=walking",
                      "?travelMode=driving&travelMode=driving", "?travelMode=driving&participantId=" + self.entry["organizer_id"],
                      "?travelMode=driving&venueId=" + PLACE_ID, "?travelMode=driving&unknown=value",
                      "?travelMode=driving&unknown", "?travelMode=driving#fragment"):
            with self.subTest(query=query), self.assertRaises(RuntimeError):
                self.authorize("GET", path + query)

    def test_directions_require_one_pending_owned_event_and_a_recorded_place(self):
        path = self.event_path + "/venues/" + PLACE_ID + "/directions?travelMode=walking"
        self.authorize("GET", path)
        other_event = {**self.entry, "event_id": "evt_1760000000001_abcdef0123456789"}
        for events in ([], [{**self.entry, "cleanup_state": "deleted"}], [self.entry, other_event]):
            with self.subTest(events=events), self.assertRaises(RuntimeError):
                self.authorize("GET", path, state={**self.state, "owned_events": events})
        for rejected in (path.replace(PLACE_ID, SECOND_PLACE_ID),
                         path.replace(self.entry["event_id"], other_event["event_id"]),
                         path.replace("/directions?", "/directions/extra?")):
            with self.subTest(path=rejected), self.assertRaises(RuntimeError):
                self.authorize("GET", rejected)

    def test_participants_allow_organizer_patch_and_one_ui_guest(self):
        base = self.event_path + "/participants"
        guest = {"name": "Verification guest", "address": "San Diego Central Library", "fuzzyLocation": False}
        self.authorize("PATCH", base + "/" + self.entry["organizer_id"], {"fuzzyLocation": True})
        self.authorize("POST", base, guest)
        with self.assertRaises(RuntimeError):
            self.authorize("POST", base, guest, purpose="negative")
        with self.assertRaises(RuntimeError):
            self.authorize("PATCH", base + "/" + self.entry["organizer_id"], {"name": "HTTP organizer"}, purpose="negative")
        self.entry["participant_ids"] = ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]
        for method, path, body in (("POST", base, guest),
                                   ("PATCH", base + "/" + self.entry["participant_ids"][0], {"name": "Changed guest"}),
                                   ("DELETE", base + "/" + self.entry["participant_ids"][0], None),
                                   ("DELETE", base + "/" + self.entry["organizer_id"], None)):
            with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                self.authorize(method, path, body)

    def test_participant_bodies_reject_credentials_roles_and_invalid_legacy_values(self):
        path = self.event_path + "/participants/" + self.entry["organizer_id"]
        self.authorize("PATCH", path, {"name": "Verification organizer", "address": "Central Library", "fuzzyLocation": False})
        for body in (None, [], {}, {"isOrganizer": True}, {"tokenHash": "fixture-only"}, {"lat": 32.71},
                     {"name": ""}, {"name": "x" * 51}, {"address": "x" * 256}, {"address": None},
                     {"fuzzyLocation": "false"}, {"fuzzyLocation": 1}):
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                self.authorize("PATCH", path, body)
        for body in ({"name": "Verification guest"}, {"address": "Central Library"}, {"fuzzyLocation": False}):
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                self.authorize("POST", self.event_path + "/participants", body)

    def test_places_scenario_does_not_authorize_votes_publish_or_foreign_participants(self):
        self.authorize("PATCH", self.event_path + "/participants/" + self.entry["organizer_id"], {"name": "Organizer"})
        for path in (self.event_path + "/votes", self.event_path + "/publish",
                     self.event_path + "/participants/cccccccc-cccc-cccc-cccc-cccccccccccc",
                     "/api/events/evt_1760000000001_abcdef0123456789/participants"):
            for method in ("POST", "PATCH", "DELETE"):
                with self.subTest(method=method, path=path), self.assertRaises(RuntimeError):
                    self.authorize(method, path, {"name": "Fixture guest", "address": "Central Library"})


class ProviderPlaceRecordingTest(unittest.TestCase):
    def test_recording_appends_unique_observed_ids_and_returns_the_observed_set(self):
        state = places_state()
        observed = ppe.record_provider_places(state, search_response(SECOND_PLACE_ID, PLACE_ID, SECOND_PLACE_ID))
        self.assertEqual(observed, [SECOND_PLACE_ID, PLACE_ID])
        self.assertEqual(state["provider_place_ids"], [PLACE_ID, SECOND_PLACE_ID])
        self.assertEqual(ppe.record_provider_places(state, search_response(SECOND_PLACE_ID)), [SECOND_PLACE_ID])
        self.assertEqual(state["provider_place_ids"], [PLACE_ID, SECOND_PLACE_ID])

    def test_invalid_envelopes_reject_without_partial_mutation(self):
        valid = search_response(SECOND_PLACE_ID)
        invalid = [None, [], {}, {**valid, "venues": {}}, {**valid, "totalResults": 2},
                   {**valid, "totalResults": True}, {**valid, "totalResults": "1"}, {**valid, "searchCenter": None},
                   {**valid, "searchCenter": {"lat": float("nan"), "lng": -117.15}},
                   {**valid, "searchCenter": {"lat": 10 ** 400, "lng": -117.15}},
                   {**valid, "searchCenter": {"lat": 91, "lng": -117.15}},
                   {**valid, "searchCenter": {"lat": 32.71, "lng": 181}},
                   {**valid, "venues": [None]}, {**valid, "venues": [{}]}]
        invalid.extend({key: value for key, value in valid.items() if key != missing} for missing in valid)
        invalid.extend(search_response(SECOND_PLACE_ID, bad_id) for bad_id in
                       (None, 1, "", "x" * 513, "place\nidentifier", "?key=fixture-only", "?token=fixture-only",
                        "AIzaFixtureOnlyNotARealKey", "pt_fixture_only_not_a_real_token"))
        state = places_state()
        self.assertEqual(ppe.record_provider_places(state, valid), [SECOND_PLACE_ID])
        for body in invalid:
            state = places_state()
            before = copy.deepcopy(state)
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                ppe.record_provider_places(state, body)
            self.assertEqual(state, before)

    def test_recording_requires_places_scenario_and_exactly_one_pending_event(self):
        self.assertEqual(ppe.record_provider_places(places_state(), search_response(SECOND_PLACE_ID)), [SECOND_PLACE_ID])
        for change in ({"scenario": "participants"}, {"scenario": "lifecycle"}, {"owned_events": []},
                       {"owned_events": [{**places_state()["owned_events"][0], "cleanup_state": "deleted"}]},
                       {"owned_events": places_state()["owned_events"] * 2}):
            state = {**places_state(), **change}
            before = copy.deepcopy(state)
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                ppe.record_provider_places(state, search_response(SECOND_PLACE_ID))
            self.assertEqual(state, before)


class PlacesParticipantReceiptTest(unittest.TestCase):
    def test_bridge_records_one_guest_id_and_rejects_a_second_guest(self):
        state = places_state()
        guest_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        payload = {"operation": "record-participant", "event_id": state["owned_events"][0]["event_id"], "participant_id": guest_id}
        with patch.object(ppe, "read_run", return_value=state), patch.object(ppe.control, "save"):
            result = ppe.bridge(Path("/unused-fixture-run"), payload)
            self.assertEqual(result, {"recorded": guest_id})
            self.assertEqual(state["owned_events"][0]["participant_ids"], [guest_id])
            self.assertEqual(ppe.bridge(Path("/unused-fixture-run"), payload), {"recorded": guest_id})
            with self.assertRaises(RuntimeError):
                ppe.bridge(Path("/unused-fixture-run"), {**payload, "participant_id": "cccccccc-cccc-cccc-cccc-cccccccccccc"})
            self.assertEqual(state["owned_events"][0]["participant_ids"], [guest_id])

    def test_bridge_rejects_organizer_foreign_event_invalid_ids_and_deleted_event(self):
        state = places_state()
        entry = state["owned_events"][0]
        payload = {"operation": "record-participant", "event_id": entry["event_id"], "participant_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}
        invalid = [{**payload, "participant_id": entry["organizer_id"]},
                   {**payload, "participant_id": "not-a-uuid"},
                   {**payload, "event_id": "evt_1760000000001_abcdef0123456789"}]
        with patch.object(ppe, "read_run", return_value=state), patch.object(ppe.control, "save"):
            for body in invalid:
                with self.subTest(body=body), self.assertRaises(RuntimeError):
                    ppe.bridge(Path("/unused-fixture-run"), body)
            self.assertEqual(ppe.bridge(Path("/unused-fixture-run"), payload), {"recorded": payload["participant_id"]})
            entry["cleanup_state"] = "deleted"
            with self.assertRaises(RuntimeError):
                ppe.bridge(Path("/unused-fixture-run"), payload)


if __name__ == "__main__":
    unittest.main()
