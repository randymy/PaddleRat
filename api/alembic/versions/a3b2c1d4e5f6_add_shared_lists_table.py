"""add shared_lists table

Revision ID: a3b2c1d4e5f6
Revises: 71b815cc4dfe
Create Date: 2026-04-07 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b2c1d4e5f6'
down_revision: Union[str, None] = '71b815cc4dfe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('shared_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('list_name', sa.Text(), nullable=False),
        sa.Column('user_ids', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shared_lists_code', 'shared_lists', ['code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_shared_lists_code', table_name='shared_lists')
    op.drop_table('shared_lists')
