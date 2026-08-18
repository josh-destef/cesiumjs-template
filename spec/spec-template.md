# Project spec — the questions worth answering

Write your spec as prose, in whatever order the conversation takes. This is not
a form. It is the short list of things that, left unanswered, produce bugs that
look like code bugs and are not.

Do **not** specify folder structure, build configuration, or stack setup. The
template already has all of that, and a spec that describes where files should
go sends the agent editing configuration that is already correct.

**Data sources.** For each one: a real URL that returns data, a trimmed example
response, and which field drives which visual element. Say what the map should
show when the source fails or returns nothing. Check CORS before designing
around an endpoint — `curl -I -H "Origin: http://localhost:5173" <url>` — and
say whether an API key is needed, because a secret key needs a proxy.

**CRS and coordinate order.** State it even when it is the obvious answer.
CesiumJS requires `EPSG:4326`, longitude first, and will not reproject for you.
Anything in Web Mercator, State Plane, UTM or a national grid must be converted
first. Watch for sources that give latitude first.

**Altitude reference.** Ellipsoidal (WGS84 HAE, what GPS and Cesium use),
orthometric (MSL/NAVD88, what most survey and government data uses), clamped to
terrain, relative to ground, or no altitude at all. Getting this wrong puts
everything consistently ~30 m underground and looks like a code bug.

**Expected feature count.** The number decides the rendering approach, and that
decision is expensive to reverse. Under 1,000: the Entity API. Over 10,000:
primitives or clustering. Over a million: 3D Tiles. If the count is uncertain,
give a range and say which end to design for. See `docs/rendering-decisions.md`.

**Licence and attribution.** The licence of each source, the exact credit text
that must appear on screen, and any restriction — non-commercial, share-alike,
no redistribution. Some sources require visible credit; state the wording.

**Camera start position.** A bounding box, or a centre point with a height. Also
say whether the camera should move when data loads or hold still. A map that
opens looking at the wrong part of the world is the fastest way to make a
finished project feel broken.

Finally, name the two or three interactions that carry the experience —
including their empty, loading and error states, and their keyboard equivalents.
A globe has none by default; the template's data table and key handlers are what
your project inherits.
