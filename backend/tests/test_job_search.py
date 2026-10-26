
import pytest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "main"))
from app import create_app


JOB_COLUMNS = [
    "id",
    "title",
    "company_name",
    "location",
    "category",
    "description",
    "min_salary",
    "max_salary",
    "created_at",
]

JOB_ROW = (
    1,
    "Software Engineering Intern",
    "Example Company",
    "Montreal, QC",
    "Engineering",
    "Help develop software.",
    50000,
    70000,
    None,
)


class FakeCursor:
    """A simple fake cursor that records SQL without a real database."""

    def __init__(self, rows=None, one_row=None, should_fail=False):
        self.rows = rows if rows is not None else [JOB_ROW]
        self.one_row = one_row
        self.should_fail = should_fail
        self.description = [(column,) for column in JOB_COLUMNS]
        self.query = None
        self.params = None

    def execute(self, query, params=()):
        if self.should_fail:
            raise RuntimeError("Simulated database error")

        self.query = query
        self.params = params

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.one_row

    def close(self):
        pass


class FakeConnection:
    def __init__(self, cursor):
        self.fake_cursor = cursor

    def cursor(self):
        return self.fake_cursor

    def close(self):
        pass


@pytest.fixture
def make_client():
    """Create a Flask test client with a mocked database."""

    def _make_client(
        rows=None,
        one_row=None,
        should_fail=False,
        connection_error=False,
    ):
        fake_cursor = FakeCursor(
            rows=rows,
            one_row=one_row,
            should_fail=should_fail,
        )

        def connection_factory():
            if connection_error:
                raise RuntimeError("Simulated connection error")
            return FakeConnection(fake_cursor)

        app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": connection_factory,
        })

        return app.test_client(), fake_cursor

    return _make_client


def test_list_jobs_returns_published_jobs(make_client):
    client, cursor = make_client()

    response = client.get("/api/jobs")

    assert response.status_code == 200
    assert len(response.json["jobs"]) == 1
    assert response.json["jobs"][0]["title"] == (
        "Software Engineering Intern"
    )
    assert response.json["jobs"][0]["min_salary"] == 50000.0
    assert response.json["jobs"][0]["max_salary"] == 70000.0
    assert "status = 'published'" in cursor.query


def test_keyword_search_uses_all_main_fields(make_client):
    client, cursor = make_client()

    response = client.get("/api/jobs?keyword=software")

    assert response.status_code == 200
    assert "ILIKE" in cursor.query
    assert cursor.params[:5] == (
        "%software%",
        "%software%",
        "%software%",
        "%software%",
        "%software%",
    )


def test_location_and_category_filters(make_client):
    client, cursor = make_client()

    response = client.get(
        "/api/jobs?location=Montreal&category=Engineering"
    )

    assert response.status_code == 200
    assert cursor.params == ("%Montreal%", "%Engineering%")
    assert "location ILIKE %s" in cursor.query
    assert "category ILIKE %s" in cursor.query


def test_salary_filters(make_client):
    client, cursor = make_client()

    response = client.get(
        "/api/jobs?min_salary=50000&max_salary=80000"
    )

    assert response.status_code == 200
    assert cursor.params == (50000.0, 80000.0)
    assert "max_salary >= %s" in cursor.query
    assert "min_salary <= %s" in cursor.query


@pytest.mark.parametrize(
    "url",
    [
        "/api/jobs?min_salary=abc",
        "/api/jobs?max_salary=abc",
        "/api/jobs?min_salary=-100",
        "/api/jobs?max_salary=nan",
        "/api/jobs?min_salary=inf",
        "/api/jobs?min_salary=90000&max_salary=50000",
    ],
)
def test_invalid_salary_filters_return_400(make_client, url):
    client, _ = make_client()

    response = client.get(url)

    assert response.status_code == 400
    assert "error" in response.json


def test_job_details_returns_job(make_client):
    client, _ = make_client(one_row=JOB_ROW)

    response = client.get("/api/jobs/1")

    assert response.status_code == 200
    assert response.json["job"]["id"] == 1
    assert response.json["job"]["min_salary"] == 50000.0
    assert response.json["job"]["max_salary"] == 70000.0


def test_missing_job_returns_404(make_client):
    client, _ = make_client(one_row=None)

    response = client.get("/api/jobs/999")

    assert response.status_code == 404


def test_database_error_returns_500(make_client):
    client, _ = make_client(should_fail=True)

    response = client.get("/api/jobs")

    assert response.status_code == 500


def test_connection_error_returns_500(make_client):
    client, _ = make_client(connection_error=True)

    response = client.get("/api/jobs")

    assert response.status_code == 500
