import csv
from typing import Iterable

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from pontoon.base.models import Entity, Locale, Project, Resource, Translation

lang_code_mapping = {
    "bg": "Bulgarian",
    "hr": "Croatian",
    "cs": "Czech",
    "da": "Danish",
    "nl": "Dutch",
    "et": "Estonian",
    "fi": "Finnish",
    "fr": "French",
    "de": "German",
    "el": "Greek",
    "hu": "Hungarian",
    "ga": "Irish",
    "it": "Italian",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "mt": "Maltese",
    "pl": "Polish",
    "pt": "Portuguese",
    "ro": "Romanian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "es": "Spanish",
    "sv": "Swedish",
    "zh": "Chinese",
}

UNTRANSLATED_MARKS = ["MISSING", "PRETRANSLATED", "REJECTED", "FUZZY", "UNREVIEWED"]


class Command(BaseCommand):
    help = "Upload translations from a CSV file. Example headers"

    def add_arguments(self, parser):
        parser.add_argument("csv_file", type=str, help="Path to the CSV file")
        parser.add_argument(
            "user_email", type=str, help="Email of User who updated the translations"
        )

    def handle(self, *args, **options):
        """
        param: input - CSV file path

        Example CSV headers:
        Project,Resource,Translation Key,Translation Source String,French,Spanish,German
        """
        csv_file = options["csv_file"]
        user_email = options["user_email"]
        with open(csv_file, "r") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            if not isinstance(headers, Iterable) or len(headers) < 5:
                raise ValueError("Wrong CSV headers: header length less than 5.")
            locale_names = headers[4:]
            if any(locale_name not in lang_code_mapping.values() for locale_name in locale_names):
                raise ValueError("Wrong CSV headers: not recognizable locale name.")

            locales = [
                Locale.objects.filter(name=locale_name).first() for locale_name in headers[4:]
            ]
            translations = [row for row in reader if any(cell for cell in row)]

        user = User.objects.get(email=user_email)
        for tr in translations:
            project = Project.objects.filter(name=tr["Project"]).first()
            if not project:
                raise ValueError('Wrong data: in column "Project"')

            resource = Resource.objects.filter(path=tr["Resource"]).first()
            if not resource:
                raise ValueError('Wrong data: in column "Resouce"')

            key = tr["Translation Key"]
            if resource.format == "json":
                key = str(key.split(".")).replace("'", '"')
            elif resource.format in ("po", "xml"):
                pass
            else:
                raise ValueError(f"Wrong data: importing {resource.format} format not supported")

            entity = Entity.objects.get(
                key=key, resource__project__id=project.id, resource__id=resource.id
            )
            for locale in locales:
                if tr[locale.name] == "" or tr[locale.name] in UNTRANSLATED_MARKS:
                    continue
                if trans_obj := entity.translation_set.filter(locale=locale, active=True).first():
                    if trans_obj.string == tr[locale.name]:
                        continue
                    trans_obj.approved = True
                    trans_obj.approved_user = user
                    trans_obj.approved_date = timezone.now()
                    trans_obj.rejected = False
                    trans_obj.rejected_user = None
                    trans_obj.rejected_date = None
                    trans_obj.pretranslated = False
                    trans_obj.fuzzy = False
                    trans_obj.save()

                # Create the translation
                Translation(
                    string=tr[locale.name],
                    user=user,
                    locale=locale,
                    entity=entity,
                    active=True,
                    approved=True,
                    approved_user=user,
                    approved_date=timezone.now(),
                    rejected=False,
                    rejected_user=None,
                    rejected_date=None,
                    pretranslated=False,
                    fuzzy=False,
                ).save()
