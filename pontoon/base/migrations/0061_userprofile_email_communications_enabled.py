# Generated by Django 4.2.11 on 2024-05-10 14:35

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "base",
            "0060_rename_entity_resource_obsolete_string_plural_base_entity_resourc_f99fa1_idx_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="email_communications_enabled",
            field=models.BooleanField(default=False),
        ),
    ]