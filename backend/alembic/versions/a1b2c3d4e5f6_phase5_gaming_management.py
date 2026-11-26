"""phase5_gaming_management

Revision ID: a1b2c3d4e5f6
Revises: ee1d4d0fee50
Create Date: 2026-11-25 20:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ee1d4d0fee50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema for Phase 5 gaming management features."""
    # 1. Create scheduled_sessions
    op.create_table(
        'scheduled_sessions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('library_entry_id', sa.String(length=36), nullable=False),
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), server_default='60', nullable=False),
        sa.Column('reminder_minutes_before', sa.Integer(), nullable=True),
        sa.Column('repeat_schedule', sa.String(length=32), server_default='none', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='Scheduled', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['library_entry_id'], ['library_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_scheduled_sessions_library_entry_id'), 'scheduled_sessions', ['library_entry_id'], unique=False)
    op.create_index(op.f('ix_scheduled_sessions_scheduled_start'), 'scheduled_sessions', ['scheduled_start'], unique=False)
    op.create_index(op.f('ix_scheduled_sessions_status'), 'scheduled_sessions', ['status'], unique=False)

    # 2. Create active_play_sessions (for crash / restart recovery)
    op.create_table(
        'active_play_sessions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('library_entry_id', sa.String(length=36), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accumulated_seconds', sa.Integer(), server_default='0', nullable=False),
        sa.Column('location_or_chapter', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_paused', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['library_entry_id'], ['library_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('library_entry_id'),
    )
    op.create_index(op.f('ix_active_play_sessions_library_entry_id'), 'active_play_sessions', ['library_entry_id'], unique=True)

    # 3. Alter journal_entries
    with op.batch_alter_table('journal_entries') as batch_op:
        batch_op.alter_column('library_entry_id', existing_type=sa.String(length=36), nullable=True)
        batch_op.add_column(sa.Column('entry_type', sa.String(length=32), server_default='Note', nullable=False))
        batch_op.add_column(sa.Column('is_spoiler', sa.Boolean(), server_default=sa.text('0'), nullable=False))
        batch_op.add_column(sa.Column('personal_rating', sa.Float(), nullable=True))
        batch_op.create_index(batch_op.f('ix_journal_entries_entry_type'), ['entry_type'], unique=False)

    # 4. Alter collections
    with op.batch_alter_table('collections') as batch_op:
        batch_op.add_column(sa.Column('banner_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('display_order', sa.Integer(), server_default='0', nullable=False))

    # 5. Alter wishlist_items
    with op.batch_alter_table('wishlist_items') as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=8), server_default='INR', nullable=False))

    # 6. Alter games
    with op.batch_alter_table('games') as batch_op:
        batch_op.add_column(sa.Column('franchise_order', sa.Integer(), server_default='0', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('games') as batch_op:
        batch_op.drop_column('franchise_order')

    with op.batch_alter_table('wishlist_items') as batch_op:
        batch_op.drop_column('currency')

    with op.batch_alter_table('collections') as batch_op:
        batch_op.drop_column('display_order')
        batch_op.drop_column('banner_url')

    with op.batch_alter_table('journal_entries') as batch_op:
        batch_op.drop_index(batch_op.f('ix_journal_entries_entry_type'))
        batch_op.drop_column('personal_rating')
        batch_op.drop_column('is_spoiler')
        batch_op.drop_column('entry_type')
        batch_op.alter_column('library_entry_id', existing_type=sa.String(length=36), nullable=False)

    op.drop_table('active_play_sessions')
    op.drop_table('scheduled_sessions')
