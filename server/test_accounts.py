import os
import tempfile
import unittest
from unittest.mock import patch

# Keep all test accounts, sessions, and rides in a temporary database.
with tempfile.TemporaryDirectory() as import_dir:
    with patch.dict(os.environ, {"DATABASE_PATH": os.path.join(import_dir, "import.db")}):
        import app as server


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.old_path = server.DATABASE_PATH
        server.DATABASE_PATH = os.path.join(self.directory.name, "test.db")
        server.init_db()
        self.client = server.app.test_client()
        self.account = {"name": "Amina", "email": "amina@example.test", "password": "test-password-123"}

    def tearDown(self):
        server.DATABASE_PATH = self.old_path
        self.directory.cleanup()

    def register(self):
        return self.client.post("/api/auth/register", json=self.account)

    def test_registration_and_reopening(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)
        cookie = response.headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Max-Age=315360000", cookie)
        self.assertIn("SameSite=Lax", cookie)
        reopened = server.app.test_client()
        reopened.set_cookie("zanzi_session", self.client.get_cookie("zanzi_session").value)
        # Reinitializing the server database keeps the session intact.
        server.init_db()
        self.assertEqual(reopened.get("/api/auth/session").json["user"]["name"], "Amina")
        with server.get_db() as db:
            self.assertNotEqual(db.execute("SELECT password_hash FROM users").fetchone()[0], self.account["password"])

    def test_duplicate_validation_and_login(self):
        self.assertEqual(self.client.post("/api/auth/register", json={}).status_code, 400)
        self.register()
        self.assertEqual(self.register().status_code, 409)
        self.assertEqual(self.client.post("/api/auth/login", json={**self.account, "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json=self.account).status_code, 200)

    def test_sign_out_revokes_session(self):
        self.register()
        token = self.client.get_cookie("zanzi_session").value
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.client.set_cookie("zanzi_session", token)
        self.assertIsNone(self.client.get("/api/auth/session").json["user"])

    def test_activity_is_private(self):
        self.register()
        response = self.client.post("/api/rides", json={"pickup": "Stone Town", "destination": "Nungwi Beach", "vehicle": "Boda"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.client.get("/api/auth/rides").json["data"]), 1)
        other = server.app.test_client()
        self.assertEqual(other.get("/api/auth/rides").status_code, 401)
        other.post("/api/auth/register", json={**self.account, "email": "other@example.test"})
        self.assertEqual(other.get("/api/auth/rides").json["data"], [])


if __name__ == "__main__":
    unittest.main()
