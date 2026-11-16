from io import BytesIO
from pathlib import Path


def extract_resume_text(file_bytes, file_name):
    extension = Path(file_name).suffix.lower()

    if extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(file_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif extension == ".docx":
        from docx import Document

        document = Document(BytesIO(file_bytes))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                paragraphs.extend(cell.text for cell in row.cells)
        text = "\n".join(paragraphs)
    else:
        raise ValueError("Only PDF and DOCX resumes are supported.")

    if not text.strip():
        raise ValueError("No readable text found in the resume.")

    return text.strip()
