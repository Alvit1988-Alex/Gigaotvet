"""Stage 2 models update

Revision ID: 20240520_stage2
Revises: 
Create Date: 2024-05-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20240520_stage2"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("admins", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column(
        "admins",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=True,
        ),
    )
    op.add_column(
        "admins",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=True,
        ),
    )
    op.create_unique_constraint("uq_admins_email", "admins", ["email"])

    op.add_column(
        "dialogs",
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=True,
        ),
    )
    op.add_column(
        "dialogs",
        sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("dialogs", sa.Column("locked_by_admin_id", sa.Integer(), nullable=True))
    op.add_column(
        "dialogs",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dialogs",
        sa.Column(
            "unread_messages_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_dialogs_locked_by_admin_id_admins",
        "dialogs",
        "admins",
        ["locked_by_admin_id"],
        ["id"],
    )

    op.add_column("messages", sa.Column("attachments", sa.Text(), nullable=True))
    op.add_column(
        "messages",
        sa.Column("message_type", sa.String(length=32), server_default="text", nullable=False),
    )

    op.add_column("pending_logins", sa.Column("ip_address", sa.String(length=64), nullable=True))
    op.add_column("pending_logins", sa.Column("user_agent", sa.String(length=512), nullable=True))

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admins.id"), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("params", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")

    op.drop_column("pending_logins", "user_agent")
    op.drop_column("pending_logins", "ip_address")

    op.drop_column("messages", "message_type")
    op.drop_column("messages", "attachments")

    op.drop_constraint("fk_dialogs_locked_by_admin_id_admins", "dialogs", type_="foreignkey")
    op.drop_column("dialogs", "unread_messages_count")
    op.drop_column("dialogs", "locked_until")
    op.drop_column("dialogs", "locked_by_admin_id")
    op.drop_column("dialogs", "is_locked")
    op.drop_column("dialogs", "last_message_at")

    op.drop_constraint("uq_admins_email", "admins", type_="unique")
    op.drop_column("admins", "updated_at")
    op.drop_column("admins", "created_at")
    op.drop_column("admins", "email")
