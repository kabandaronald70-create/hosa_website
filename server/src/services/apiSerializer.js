export function serializeMember(row) {
  const first = row.first_name || "";
  const last = row.last_name || "";
  const name = (row.display_name || `${first} ${last}`).trim();

  return {
    id: row.seed_ref || row.user_id,
    userId: row.user_id,
    name,
    classYear: row.graduation_year,
    country: row.country_code,
    district: row.district,
    profession: row.profession,
    organization: row.organization,
    bio: row.biography,
    mentor: row.mentor_opt_in === true,
    mentorField: row.mentor_field || "",
    contactPreference: row.preferred_contact
      ? row.preferred_contact.charAt(0).toUpperCase() +
        row.preferred_contact.slice(1)
      : "",
    avatar: row.avatar_path ? `/dashboard/avatar/${row.user_id}` : "",
    verified: row.verified_at != null,
  };
}

export function serializeEvent(row) {
  return {
    id: row.external_ref || row.slug,
    title: row.title,
    date: row.starts_at ? row.starts_at.toISOString().slice(0, 10) : null,
    venue: row.venue,
    district: row.district,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    description: row.description,
    type: row.event_type || "",
    rsvp: false, // overridden per-user by the RSVP endpoint in a later phase
  };
}

export function serializeOpportunity(row) {
  return {
    id: row.external_ref || row.slug,
    title: row.title,
    employer: row.employer || row.organization || "",
    location: row.location,
    type: row.type_label || "",
    postedBy: row.posted_by_ref || "",
    deadline: row.deadline
      ? row.deadline instanceof Date
        ? row.deadline.toISOString().slice(0, 10)
        : String(row.deadline)
      : null,
    description: row.description,
    saved: false, // per-user, added in a later phase
  };
}

export function serializeStory(row) {
  return {
    id: row.external_ref || row.slug,
    title: row.title,
    author: row.author_name || "",
    authorId: row.author_ref || "",
    classYear: row.class_year,
    category: row.category || "",
    excerpt: row.excerpt || "",
    body: row.body,
    date: row.story_date
      ? row.story_date instanceof Date
        ? row.story_date.toISOString().slice(0, 10)
        : String(row.story_date)
      : null,
  };
}
