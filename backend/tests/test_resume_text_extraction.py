from io import BytesIO
from unittest.mock import patch

import pytest
from docx import Document
from pypdf import PdfWriter

from src.main.resume_text_extraction import (
    extract_resume_text,
    MAX_RESUME_SIZE,
    MAX_RESUME_CHARACTERS,
)


def test_extract_valid_docx():
    document = Document()
    document.add_paragraph("Software Developer")
    document.add_paragraph("Python and C++ experience")

    buffer = BytesIO()
    document.save(buffer)

    result = extract_resume_text(
        buffer.getvalue(),
        "resume.docx",
    )

    assert "Software Developer" in result
    assert "Python and C++ experience" in result


def test_extract_pdf_text():
    with patch(
        "src.main.resume_text_extraction._extract_pdf_text",
        return_value="Software Developer",
    ):
        result = extract_resume_text(
            b"sample PDF",
            "resume.pdf",
        )

    assert result == "Software Developer"


def test_empty_resume():
    with pytest.raises(ValueError, match="empty"):
        extract_resume_text(b"", "resume.pdf")


def test_oversized_resume():
    file_bytes = b"a" * (MAX_RESUME_SIZE + 1)

    with pytest.raises(ValueError, match="10 MB"):
        extract_resume_text(file_bytes, "resume.pdf")


def test_unsupported_file_type():
    with pytest.raises(ValueError, match="PDF and DOCX"):
        extract_resume_text(b"resume content", "resume.txt")


def test_corrupted_pdf():
    with pytest.raises(ValueError, match="Unable to read"):
        extract_resume_text(b"invalid PDF", "resume.pdf")


def test_corrupted_docx():
    with pytest.raises(ValueError, match="Unable to read"):
        extract_resume_text(b"invalid DOCX", "resume.docx")


def test_pdf_without_readable_text():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)

    buffer = BytesIO()
    writer.write(buffer)

    with pytest.raises(ValueError, match="No readable text"):
        extract_resume_text(
            buffer.getvalue(),
            "resume.pdf",
        )


def test_password_protected_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.encrypt("test-password")

    buffer = BytesIO()
    writer.write(buffer)

    with pytest.raises(ValueError, match="Password-protected"):
        extract_resume_text(
            buffer.getvalue(),
            "resume.pdf",
        )


def test_resume_exceeds_character_limit():
    with patch(
        "src.main.resume_text_extraction._extract_pdf_text",
        return_value="a" * (MAX_RESUME_CHARACTERS + 1),
    ):
        with pytest.raises(ValueError, match="too much text"):
            extract_resume_text(
                b"sample PDF",
                "resume.pdf",
            )