# Generated by Django 3.2.13 on 2022-08-08 17:46

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("base", "0031_userprofile_bio"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="visibility_approval",
            field=models.CharField(
                choices=[
                    ("Public", "Public"),
                    ("Translators", "Users with translator rights"),
                ],
                default="Public",
                max_length=20,
                verbose_name="Approval ratio",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="visibility_email",
            field=models.CharField(
                choices=[
                    ("Logged in users", "Logged in users"),
                    ("Translators", "Users with translator rights"),
                ],
                default="Translators",
                max_length=20,
                verbose_name="Email address",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="visibility_external_accounts",
            field=models.CharField(
                choices=[
                    ("Public", "Public"),
                    ("Translators", "Users with translator rights"),
                ],
                default="Translators",
                max_length=20,
                verbose_name="External accounts",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="visibility_self_approval",
            field=models.CharField(
                choices=[
                    ("Public", "Public"),
                    ("Translators", "Users with translator rights"),
                ],
                default="Public",
                max_length=20,
                verbose_name="Self-approval ratio",
            ),
        ),
    ]
