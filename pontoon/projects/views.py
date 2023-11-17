import csv
import json
import uuid
from io import StringIO
from operator import attrgetter
from typing import Iterable

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Q
from django.http import Http404, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.generic.detail import DetailView
from guardian.decorators import permission_required_or_403
from notifications.models import Notification
from notifications.signals import notify

from pontoon.base.models import Entity, Locale, Project, Resource, Translation
from pontoon.base.utils import get_project_or_redirect, require_AJAX, split_ints
from pontoon.contributors.views import ContributorsMixin
from pontoon.insights.utils import get_insights
from pontoon.projects import forms
from pontoon.tags.utils import TagsTool


def projects(request):
    """List all active projects."""
    projects = (
        Project.objects.visible()
        .visible_for(request.user)
        .prefetch_related("latest_translation__user")
        .order_by("name")
    )

    if not projects:
        return render(request, "no_projects.html", {"title": "Projects"})

    return render(
        request,
        "projects/projects.html",
        {"projects": projects, "top_instances": projects.get_top_instances()},
    )


def project(request, slug):
    """Project dashboard."""
    project = get_project_or_redirect(
        slug, "pontoon.projects.project", "slug", request.user
    )
    if isinstance(project, HttpResponseRedirect):
        return project

    project_locales = project.project_locale
    chart = project

    # Only include filtered teams if provided
    teams = request.GET.get("teams", "").split(",")
    filtered_locales = Locale.objects.filter(code__in=teams)
    if filtered_locales.exists():
        project_locales = project_locales.filter(locale__in=filtered_locales)
        chart = project_locales.aggregated_stats()

    return render(
        request,
        "projects/project.html",
        {
            "chart": chart,
            "count": project_locales.count(),
            "project": project,
            "tags_count": (
                project.tag_set.filter(resources__isnull=False).distinct().count()
                if project.tags_enabled
                else None
            ),
        },
    )


@require_AJAX
def ajax_teams(request, slug):
    """Teams tab."""
    project = get_object_or_404(
        Project.objects.visible_for(request.user).available(), slug=slug
    )

    locales = Locale.objects.available()

    # Only include filtered teams if provided
    teams = request.GET.get("teams", "").split(",")
    filtered_locales = Locale.objects.filter(code__in=teams)
    if filtered_locales.exists():
        locales = locales.filter(pk__in=filtered_locales)

    locales = locales.prefetch_project_locale(project).order_by("name")

    return render(
        request,
        "projects/includes/teams.html",
        {"project": project, "locales": locales},
    )


@require_AJAX
def ajax_tags(request, slug):
    """Tags tab."""
    project = get_object_or_404(Project.objects.visible_for(request.user), slug=slug)

    if not project.tags_enabled:
        raise Http404

    tags_tool = TagsTool(
        projects=[project],
        priority=True,
    )

    tags = sorted(tags_tool, key=attrgetter("priority"), reverse=True)

    return render(
        request,
        "projects/includes/tags.html",
        {"project": project, "tags": tags},
    )


@require_AJAX
def ajax_insights(request, slug):
    """Insights tab."""
    if not settings.ENABLE_INSIGHTS:
        raise ImproperlyConfigured("ENABLE_INSIGHTS variable not set in settings.")

    project = get_object_or_404(
        Project.objects.visible_for(request.user).available(), slug=slug
    )
    insights = get_insights(project=project)

    return render(request, "projects/includes/insights.html", insights)


@require_AJAX
def ajax_info(request, slug):
    """Info tab."""
    project = get_object_or_404(
        Project.objects.visible_for(request.user).available(), slug=slug
    )

    return render(request, "projects/includes/info.html", {"project": project})


@permission_required_or_403("base.can_manage_project")
@transaction.atomic
@require_AJAX
def ajax_notifications(request, slug):
    """Notifications tab."""
    project = get_object_or_404(
        Project.objects.visible_for(request.user).available(), slug=slug
    )
    available_locales = project.locales.prefetch_project_locale(project).order_by(
        "name"
    )

    # Send notifications
    if request.method == "POST":
        form = forms.NotificationsForm(request.POST)

        if not form.is_valid():
            return JsonResponse(dict(form.errors.items()))

        contributors = User.objects.filter(
            translation__entity__resource__project=project,
        )

        # For performance reasons, only filter contributors for selected
        # locales if different from all project locales
        available_ids = sorted(list(available_locales.values_list("id", flat=True)))
        selected_ids = sorted(split_ints(form.cleaned_data.get("selected_locales")))

        if available_ids != selected_ids:
            contributors = User.objects.filter(
                translation__entity__resource__project=project,
                translation__locale__in=available_locales.filter(id__in=selected_ids),
            )

        identifier = uuid.uuid4().hex
        for contributor in contributors.distinct():
            notify.send(
                request.user,
                recipient=contributor,
                verb="has sent a message in",
                target=project,
                description=form.cleaned_data.get("message"),
                identifier=identifier,
            )

    # Detect previously sent notifications using a unique identifier
    # TODO: We should simplify this with a custom Notifications model
    notifications_map = {}

    for notification in Notification.objects.filter(
        description__isnull=False,
        target_content_type=ContentType.objects.get_for_model(project),
        target_object_id=project.id,
    ):
        identifier = notification.data["identifier"]
        if identifier not in notifications_map:
            notifications_map[identifier] = notification

    notifications = list(notifications_map.values())
    notifications.sort(key=lambda x: x.timestamp, reverse=True)

    # Recipient shortcuts
    incomplete = []
    complete = []
    for available_locale in available_locales:
        completion_percent = available_locale.get_chart(project)["completion_percent"]
        if completion_percent == 100:
            complete.append(available_locale.pk)
        else:
            incomplete.append(available_locale.pk)

    return render(
        request,
        "projects/includes/manual_notifications.html",
        {
            "form": forms.NotificationsForm(),
            "project": project,
            "available_locales": available_locales,
            "notifications": notifications,
            "incomplete": incomplete,
            "complete": complete,
        },
    )


class ProjectContributorsView(ContributorsMixin, DetailView):
    """
    Renders view of contributors for the project.
    """

    template_name = "projects/includes/contributors.html"
    model = Project

    def get_queryset(self):
        return super().get_queryset().visible_for(self.request.user)

    def get_context_object_name(self, obj):
        return "project"

    def contributors_filter(self, **kwargs):
        return Q(entity__resource__project=self.object)


def generate_translation_stats_csv(
    slug: str, project: Project, user: User
) -> HttpResponse:
    project_locales = project.project_locale.all()
    pl_names = [pl.locale.name for pl in project_locales]
    response = HttpResponse(content_type="text/csv")
    response[
        "Content-Disposition"
    ] = f'attachment; filename="{project.slug}_translations_stats.csv"'

    headers = [
        "Resource",
        "Translation Key",
        "Translation Source String",
    ] + pl_names
    writer = csv.writer(response, quoting=csv.QUOTE_ALL)
    writer.writerow(headers)

    csv_dict = {field: [] for field in headers}
    for resource in project.resources.all():
        all_resource_entities = resource.entities.all()
        for i, pl in enumerate(project_locales):
            # l = pl.locale
            # q = Q(Q(resource__project__id=p.id) & Q(resource__id=resource.id) & ~Entity.objects.translated(l, p))
            # untranslated_entities = Entity.objects.filter(q)
            if i == 0:
                csv_dict["Resource"] += [resource.path] * len(all_resource_entities)
            for entity in all_resource_entities:
                if i == 0:
                    if resource.format == "json":
                        key: str = ".".join(json.loads(entity.key))
                    elif resource.format == "xliff":
                        key = entity.key.split("\x04")[-1]
                    else:
                        key = entity.key
                    csv_dict["Translation Key"].append(key)
                    csv_dict["Translation Source String"].append(entity.string)
                if translation := entity.translation_set.filter(
                    active=True, locale_id=pl.locale.id
                ).first():
                    if translation.approved:
                        mark = translation.string
                    elif translation.pretranslated:
                        mark = "PRETRANSLATED"
                    elif translation.rejected:
                        mark = "REJECTED"
                    elif translation.fuzzy:
                        mark = "FUZZY"
                    else:
                        mark = "UNREVIEWED"
                else:
                    mark = "MISSING"
                csv_dict[pl.locale.name].append(mark)

    columns = [column for column in csv_dict.values()]
    rows = list(zip(*columns))
    writer.writerows(rows)
    return response


def upload_translations(csv_file, project: Project, user: User):
    UNTRANSLATED_MARKS = ["MISSING", "PRETRANSLATED", "REJECTED", "FUZZY", "UNREVIEWED"]

    csv_data = csv_file.read().decode("utf-8")
    reader = csv.DictReader(StringIO(csv_data))
    headers = reader.fieldnames
    if not isinstance(headers, Iterable) or len(headers) < 4:
        raise ValueError("Wrong CSV headers: header length less than 5.")
    locale_names = headers[3:]
    if any(
        locale_name not in Locale.objects.values_list("name", flat=True)
        for locale_name in locale_names
    ):
        raise ValueError("Wrong CSV headers: not recognizable locale name.")

    locales = [
        Locale.objects.filter(name=locale_name).first() for locale_name in headers[4:]
    ]
    translations = [row for row in reader if any(cell for cell in row)]

    for tr in translations:
        resource = Resource.objects.filter(path=tr["Resource"]).first()
        if not resource:
            raise ValueError('Wrong data: in column "Resouce"')

        key = tr["Translation Key"]
        if resource.format == "json":
            key = str(key.split(".")).replace("'", '"')
        elif resource.format in ("po", "xml"):
            pass
        else:
            return redirect("pontoon.projects.project", slug=project.slug)

        entity = Entity.objects.get(
            key=key, resource__project__id=project.id, resource__id=resource.id
        )
        for locale in locales:
            if tr[locale.name] == "" or tr[locale.name] in UNTRANSLATED_MARKS:
                continue
            # if same translation exists for the entity, skip creating translation
            trans_string = tr[locale.name]
            if entity.translation_set.filter(locale=locale, string=trans_string):
                continue

            activate_new_translation = False
            if user.can_translate(project=project, locale=locale):
                activate_new_translation = True

            # Create new translation for the entity
            new_trans = Translation(
                string=trans_string,
                user=user,
                locale=locale,
                entity=entity,
                active=False,
                approved=False,
                date=timezone.now(),
                rejected=False,
                rejected_user=None,
                rejected_date=None,
                pretranslated=False,
                fuzzy=False,
            )

            if activate_new_translation:
                new_trans.active = True
                new_trans.approved = True
                new_trans.approved_user = user
                new_trans.approved_date = timezone.now()
                if current_translation := entity.translation_set.filter(
                    locale=locale, active=True
                ).first():
                    with transaction.atomic():
                        current_translation.active = False
                        current_translation.save()
                        new_trans.save()
                    return
            new_trans.save()


def export_csv(request, slug=None):
    """
    Export the translations and statistics of a project to a CSV file.
    """
    if slug:
        user = request.user
        project = get_object_or_404(Project, slug=slug)
        return generate_translation_stats_csv(slug, project=project, user=user)
    else:
        return redirect("pontoon.error")


def import_csv(request, slug=None):
    """
    Upload translations from a CSV file to a project.
    """
    # Check if a file was uploaded
    if "importCsvFile" not in request.FILES:
        return JsonResponse({"message": "No file was uploaded."}, status=400)

    # Get the uploaded file
    csv_file = request.FILES["importCsvFile"]

    user = request.user
    project = get_object_or_404(Project, slug=slug)
    if project and user:
        upload_translations(csv_file=csv_file, project=project, user=user)

        return redirect("pontoon.projects.project", slug=project.slug)
    else:
        return redirect("pontoon.error")
