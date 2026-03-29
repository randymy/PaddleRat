from datetime import timedelta
from urllib.parse import quote, urlencode


def build_google_calendar_link(
    location: str,
    court_number: str | None,
    scheduled_at,
    player_names: list[str],
    duration_hours: int = 2,
) -> str:
    """Build a Google Calendar 'Add Event' link for the session."""
    title = f"Platform Tennis @ {location}"
    start = scheduled_at.strftime("%Y%m%dT%H%M%S")
    end = (scheduled_at + timedelta(hours=duration_hours)).strftime("%Y%m%dT%H%M%S")

    details_parts = []
    if court_number:
        details_parts.append(f"Court {court_number}")
    details_parts.append(", ".join(player_names))
    details = " | ".join(details_parts)

    params = urlencode(
        {
            "action": "TEMPLATE",
            "text": title,
            "dates": f"{start}/{end}",
            "details": details,
            "location": location,
        },
        quote_via=quote,
    )
    return f"https://calendar.google.com/calendar/render?{params}"
