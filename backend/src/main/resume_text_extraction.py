from io import BytesIO
from pathlib import Path


MAX_RESUME_SIZE = 10 * 1024 * 1024
MAX_RESUME_CHARACTERS = 50000


def extract_resume_text(file_bytes, file_name):
    """Extract readable text from a PDF or DOCX resume."""

    if not file_bytes:
        raise ValueError("The resume file is empty.")

    if len(file_bytes) > MAX_RESUME_SIZE:
        raise ValueError("Resume must be 10 MB or smaller.")

    extension = Path(file_name).suffix.lower()

    if extension == ".pdf":
        text = _extract_pdf_text(file_bytes)

    elif extension == ".docx":
        text = _extract_docx_text(file_bytes)

    else:
        raise ValueError(
            "AI resume feedback only supports PDF and DOCX files."
        )

    text = text.strip()

    if not text:
        raise ValueError(
            "No readable text found in the resume. "
            "Please upload a text-based PDF or DOCX file."
        )

    if len(text) > MAX_RESUME_CHARACTERS:
        raise ValueError(
            "The resume contains too much text for AI analysis."
        )

    return text


def _extract_pdf_text(file_bytes):
    """Extract text from a PDF document."""

    from pypdf import PdfReader

    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as error:
        raise ValueError(
            "Unable to read the PDF resume."
        ) from error

    if reader.is_encrypted:
        raise ValueError(
            "Password-protected PDFs are not supported."
        )

    try:
        return "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )
    except Exception as error:
        raise ValueError(
            "Unable to extract text from the PDF resume."
        ) from error


def _extract_docx_text(file_bytes):
    """Extract text from DOCX paragraphs and tables."""

    from docx import Document

    try:
        document = Document(BytesIO(file_bytes))

        paragraphs = [
            paragraph.text
            for paragraph in document.paragraphs
        ]

        for table in document.tables:
            for row in table.rows:
                paragraphs.extend(
                    cell.text for cell in row.cells
                )

        return "\n".join(paragraphs)

    except Exception as error:
        raise ValueError(
            "Unable to read the DOCX resume."
        ) from error