
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader
from docx import Document


def extract_resume_text(file_bytes, file_name):
    """Extract text from a PDF or DOCX resume."""

    extension = Path(file_name).suffix.lower()

    if extension == ".pdf":
        reader = PdfReader(BytesIO(file_bytes))

        text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    elif extension == ".docx":
        document = Document(BytesIO(file_bytes))

        paragraphs = [
            paragraph.text
            for paragraph in document.paragraphs
        ]

        # Include text stored inside tables.
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    paragraphs.append(cell.text)

        text = "\n".join(paragraphs)

    else:
        raise ValueError("Only PDF and DOCX resumes are supported.")

    if not text.strip():
        raise ValueError("No readable text found in the resume.")

    return text.strip()
