"""Add RAG infrastructure and AI instructions

Revision ID: 20240527_rag
Revises: 20240520_stage2
Create Date: 2024-05-27 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20240527_rag"
down_revision = "20240520_stage2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_instructions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    op.create_table(
        "knowledge_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename_original", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("total_chunks", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_id", sa.Integer(), sa.ForeignKey("knowledge_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", sa.JSON(), nullable=True),
    )
    op.create_index("ix_knowledge_chunks_file_id", "knowledge_chunks", ["file_id"])
    op.create_index("uq_knowledge_chunks_file_idx", "knowledge_chunks", ["file_id", "chunk_index"], unique=True)

    op.add_column("messages", sa.Column("metadata", sa.JSON(), nullable=True))
    op.add_column(
        "messages",
        sa.Column(
            "is_fallback",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "messages",
        sa.Column(
            "used_rag",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "messages",
        sa.Column(
            "ai_reply_during_operator_wait",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("messages", "ai_reply_during_operator_wait")
    op.drop_column("messages", "used_rag")
    op.drop_column("messages", "is_fallback")
    op.drop_column("messages", "metadata")

    op.drop_index("uq_knowledge_chunks_file_idx", table_name="knowledge_chunks")
    op.drop_index("ix_knowledge_chunks_file_id", table_name="knowledge_chunks")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_files")
    op.drop_table("ai_instructions")
