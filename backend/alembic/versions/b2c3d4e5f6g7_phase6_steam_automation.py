"""phase6_steam_automation

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-26 08:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema for Phase 6 Steam integration and automation."""
    # 1. Create steam_accounts
    op.create_table(
        'steam_accounts',
        sa.Column('steam_id_64', sa.String(length=32), nullable=False),
        sa.Column('persona_name', sa.String(length=255), nullable=True),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('profile_url', sa.String(length=500), nullable=True),
        sa.Column('community_visibility_state', sa.Integer(), server_default='3', nullable=False),
        sa.Column('auto_sync_enabled', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('sync_interval_hours', sa.Integer(), server_default='24', nullable=False),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_connected', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('steam_id_64'),
    )

    # 2. Create steam_achievements
    op.create_table(
        'steam_achievements',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('game_id', sa.String(length=36), nullable=False),
        sa.Column('api_name', sa.String(length=128), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_url', sa.String(length=500), nullable=True),
        sa.Column('icon_gray_url', sa.String(length=500), nullable=True),
        sa.Column('is_hidden', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('unlocked', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('unlock_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('global_percentage', sa.Float(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_steam_achievements_game_id'), 'steam_achievements', ['game_id'], unique=False)
    op.create_index(op.f('ix_steam_achievements_api_name'), 'steam_achievements', ['api_name'], unique=False)
    op.create_index(op.f('ix_steam_achievements_unlocked'), 'steam_achievements', ['unlocked'], unique=False)

    # 3. Alter library_entries for Steam playtime and local launch config
    with op.batch_alter_table('library_entries') as batch_op:
        batch_op.add_column(sa.Column('steam_playtime_minutes', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('steam_last_played_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('executable_path', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('launch_arguments', sa.String(length=255), nullable=True))

    # 4. Alter wishlist_items for ITAD price tracking
    with op.batch_alter_table('wishlist_items') as batch_op:
        batch_op.add_column(sa.Column('current_price', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('discount_percent', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('historical_low_price', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('store_deal_name', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('deal_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('price_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('wishlist_items') as batch_op:
        batch_op.drop_column('price_updated_at')
        batch_op.drop_column('deal_url')
        batch_op.drop_column('store_deal_name')
        batch_op.drop_column('historical_low_price')
        batch_op.drop_column('discount_percent')
        batch_op.drop_column('current_price')

    with op.batch_alter_table('library_entries') as batch_op:
        batch_op.drop_column('launch_arguments')
        batch_op.drop_column('executable_path')
        batch_op.drop_column('steam_last_played_at')
        batch_op.drop_column('steam_playtime_minutes')

    op.drop_table('steam_achievements')
    op.drop_table('steam_accounts')
