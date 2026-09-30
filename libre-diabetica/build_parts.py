#!/usr/bin/env python3
"""Build the printable parts of the Libre diabetica replica (FDM).

    cap   white, smooth face, 'diabetica' pressed into the side, screws onto the base (3-start
          thread, a third of a turn), so fronts can be swapped
    base  clear, ribbed like a Libre, sits on the outside of the sleeve
    ring  split clip ring inside the shirt, snaps into the base through the fabric
    lock  disc in the middle of the ring with four pins: they go through the fabric
          and the base and are melted over on top of the base with a soldering iron,
          under the cap. The NFC sticker is sealed inside the lock (the print is
          paused to drop it in), so washing water never reaches it.

Nothing can be taken off from inside the shirt.

Checks the fit, writes print-ready STL files (already turned the way they go on
the bed) to ./stl and refreshes the meshes embedded in Libre_Diabetica_3D.html.

    pip install manifold3d numpy matplotlib
    python3 build_parts.py

All sizes are millimetres, Z up, z = 0 is the underside of the base, which is
where the outer face of the fabric sits.
"""
import base64
import json
import math
import re
import struct
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, FillRule, Manifold, OpType

HERE = Path(__file__).resolve().parent
PAGE = HERE / "Libre_Diabetica_3D.html"
STL_DIR = HERE / "stl"
SEG = 256

FABRIC = 0.5          # t-shirt jersey squeezed in the clamp (designed for 0.3 ... 0.6)
FABRIC_RANGE = (0.3, 0.5, 0.6)

# base: Libre 1:1, Ø35, ribbed side 2.6 mm, thread boss on top for the cap
R_OUT, RIBS, RIB_MID, RIB_AMP = 17.5, 96, 17.41, 0.09
BASE_TOP = 2.6

# groove under the base that the ring snaps into
GROOVE_IN = 12.2      # inner wall, widened towards the opening so the ring has room to squeeze
GROOVE_TOP = 2.0      # ceiling, leaves 0.6 mm under the cap
CHAMBER_OUT = 16.45   # outer wall of the undercut, leaves ~0.9 mm rib wall
LIP_R = 15.35         # the lip the ring hooks behind
LIP_Z_IN, LIP_Z_OUT = 0.5, 0.39   # lip top slopes down outwards (dovetail), so a pull locks harder
SLOPE = (LIP_Z_IN - LIP_Z_OUT) / 1.05   # ~6°, the hook face copies it

# split clip ring (worn inside the shirt), modelled as printed = relaxed
PRELOAD = 0.2         # ring presses the fabric outward against the lip by this much
COLLAR = 1.0          # collar wall
HOOK = 0.8            # how far the hook reaches behind the lip, plastic on plastic
FLANGE_IN, FLANGE_OUT = 11.0, 16.5
FLANGE_T = 1.2
GAP_DEG = 34.0        # cut in the ring, closes when it is squeezed through the lip
LOCK_GROOVE = (-1.3, -0.9, 0.5)   # groove in the flange's inner wall for the click lock's hooks

# click lock (second variant, no holes in the fabric): three tabs click into the ring;
# glue (E6000) through the fabric makes it final. Ø20 NFC in a pocket, sealed by the glue
TAB_BAND, TAB_SLOT, TAB_DEG = 1.2, 0.8, 60.0
LOCK_HOOK_R, LOCK_HOOK_Z = 11.25, (-1.2, -1.0)
CLICK_NFC_TAG, CLICK_NFC_POCKET = 10.0, 10.2

# lock disc: fills the middle of the ring so the ring cannot shrink any more
LOCK_R = 10.55        # a hair under the ring's hole with the thickest fabric
PIN_R, PIN_D, PIN_N = 9.3, 1.6, 4
PIN_HOLE = 2.0
PIN_OVER = 1.0        # sticks out over the boss, melted flat into the countersink
SINK_D, SINK_DEPTH = 3.4, 0.5
FUNNEL_D = 3.0        # entry funnel under each hole, so the pins find their way in

# NFC sticker (Ø15, NTAG213) sealed inside the lock: the lock prints skin side down,
# the print pauses at NFC_PAUSE, the sticker goes in, the rest prints over it
NFC_TAG, NFC_T = 7.5, 0.35
NFC_POCKET = 7.7
NFC_FLOOR, NFC_ROOM = 0.4, 0.4
NFC_PAUSE = NFC_FLOOR + NFC_ROOM

# cap on a thread: 3 starts like a bottle cap, a third of a turn from touch to tight,
# fine enough that the teeth catch all the way round; flanks ~35° off vertical print clean
THREAD_ROOT, THREAD_CREST = 13.0, 13.6
THREAD_LEAD, THREAD_STARTS = 3.6, 3
THREAD_CLR = 0.2      # radial play for FDM, the teeth still overlap by 0.4 mm
BOSS_TOP = 3.8
CAP_TOP, CAP_EDGE = 5.0, 0.8
SOCKET_TOP = 4.0      # 0.2 mm over the boss

# brand name pressed into the side of the cap, where the original model had it:
# centred on +X, on the straight part of the side wall; the face stays smooth
TEXT, TEXT_HEIGHT, TEXT_DEPTH = "diabetica", 1.2, 0.3
TEXT_Z = (BASE_TOP + 0.2 + CAP_TOP - CAP_EDGE) / 2       # middle of the straight side



def revolve(profile, segments=SEG, degrees=360.0):
    return Manifold.revolve(CrossSection([profile]), circular_segments=segments, revolve_degrees=degrees)


def cone(z0, r0, z1, r1):
    return Manifold.cylinder(z1 - z0, r0, r1, SEG).translate([0, 0, z0])


def at_pins(part):
    out = []
    for i in range(PIN_N):
        a = math.radians(45 + 90 * i)
        out.append(part.translate([PIN_R * math.cos(a), PIN_R * math.sin(a), 0]))
    return Manifold.batch_boolean(out, OpType.Add)


def thread(clearance, height):
    """Helical thread as a twisted extrusion; the same call makes the boss and the socket."""
    depth = THREAD_CREST - THREAD_ROOT

    def f(u):                                   # axial profile over one pitch: crest, flank, root, flank
        u %= 1.0
        if u < 0.15:
            return 1.0
        if u < 0.5:
            return 1.0 - (u - 0.15) / 0.35
        if u < 0.65:
            return 0.0
        return (u - 0.65) / 0.35

    n = 360
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = THREAD_ROOT + clearance + depth * f(-THREAD_STARTS * a / (2 * math.pi))
        pts.append((r * math.cos(a), r * math.sin(a)))
    return Manifold.extrude(CrossSection([pts]), height, n_divisions=max(8, int(height / 0.04)),
                            twist_degrees=360.0 * height / THREAD_LEAD)


def body_click_part():
    lip_foot = LIP_R + 0.25
    profile = [
        (0, 0), (GROOVE_IN - 0.8, 0), (GROOVE_IN, 1.0), (GROOVE_IN, GROOVE_TOP),
        (CHAMBER_OUT, GROOVE_TOP), (CHAMBER_OUT, LIP_Z_OUT), (LIP_R, LIP_Z_IN),
        (LIP_R, 0.25), (lip_foot, 0), (17.2, 0), (R_OUT, 0.3), (R_OUT, BASE_TOP - 0.2),
        (R_OUT - 0.2, BASE_TOP), (0, BASE_TOP),
    ]
    solid = revolve(profile, RIBS * 4)

    def ribs(v):
        v = np.array(v, dtype=np.float64)
        r = np.hypot(v[:, 0], v[:, 1])
        wall = (r > R_OUT - 0.02) & (v[:, 2] > 0.29)
        a = np.arctan2(v[wall, 1], v[wall, 0])
        rr = RIB_MID + RIB_AMP * np.cos(RIBS * a)
        v[wall, 0] = rr * np.cos(a)
        v[wall, 1] = rr * np.sin(a)
        return v

    z0 = BASE_TOP - 0.05
    boss = thread(0.0, BOSS_TOP - z0).translate([0, 0, z0])
    top = THREAD_CREST - 0.2                    # 45° lead-in over the top 0.2 mm only
    boss = boss ^ cone(BASE_TOP - 0.1, top + BOSS_TOP - BASE_TOP + 0.1, BOSS_TOP, top)
    return solid.warp_batch(ribs) + boss


def body_part():
    body = body_click_part()
    holes = at_pins(Manifold.cylinder(BOSS_TOP + 2, PIN_HOLE / 2, PIN_HOLE / 2, 48).translate([0, 0, -1]))
    sinks = at_pins(cone(BOSS_TOP - SINK_DEPTH, PIN_HOLE / 2, BOSS_TOP + 0.01, SINK_D / 2))
    funnels = at_pins(cone(-0.01, FUNNEL_D / 2, (FUNNEL_D - PIN_HOLE) / 2, PIN_HOLE / 2))
    return body - holes - sinks - funnels


def cap_part():
    outer = revolve([(0, BASE_TOP), (R_OUT - 0.2, BASE_TOP), (R_OUT, BASE_TOP + 0.2),
                     (R_OUT, CAP_TOP - CAP_EDGE), (R_OUT - CAP_EDGE, CAP_TOP), (0, CAP_TOP)])
    z0 = BASE_TOP - 0.05                        # same start and phase as the boss
    socket = thread(THREAD_CLR, SOCKET_TOP - z0).translate([0, 0, z0])
    mouth = THREAD_CREST + THREAD_CLR           # 45° mouth chamfer, leaves the thread itself alone
    lead_in = cone(BASE_TOP - 0.1, mouth + 0.4, BASE_TOP + 0.3, mouth)
    return outer - socket - lead_in - text_part()


def text_part():
    from matplotlib.font_manager import FontProperties, findfont
    from matplotlib.textpath import TextPath

    font = FontProperties(fname=findfont(FontProperties(family="DejaVu Sans", weight="bold")))
    path = TextPath((0, 0), TEXT, size=1.0, prop=font)
    polys = [np.asarray(p) for p in path.to_polygons(closed_only=True)]
    pts = np.vstack(polys)
    lo, hi = pts.min(0), pts.max(0)
    k = TEXT_HEIGHT / (hi[1] - lo[1])
    centre = (lo + hi) / 2
    shapes = [[tuple((q - centre) * k) for q in poly[:-1]] for poly in polys]
    flat = Manifold.extrude(CrossSection(shapes, FillRule.EvenOdd), TEXT_DEPTH + 0.2, n_divisions=1)

    def wrap(v):                                 # flat letters (x along, y up, z inward) onto the side wall
        v = np.array(v, dtype=np.float64)
        a = v[:, 0] / R_OUT
        r = R_OUT + 0.2 - v[:, 2]
        return np.c_[r * np.cos(a), r * np.sin(a), TEXT_Z + v[:, 1]]

    return flat.refine_to_length(0.3).warp_batch(wrap)



def ring_geometry():
    """Radii of the ring in the relaxed (printed) state."""
    fo = LIP_R - FABRIC + PRELOAD          # collar outer face
    fi = fo - COLLAR
    bo = fo + HOOK                         # hook tip
    hook_z = LIP_Z_IN + FABRIC + SLOPE * HOOK   # hook rests on the lip with the fabric between
    top = GROOVE_TOP - FABRIC              # collar tip, fabric draped over it touches the ceiling
    return fo, fi, bo, hook_z, top


def ring_part():
    fo, fi, bo, hook_z, top = ring_geometry()
    bot, flange_top = -FABRIC - FLANGE_T, -FABRIC
    tip_z = hook_z - SLOPE * HOOK + 0.08
    gz0, gz1, gd = LOCK_GROOVE
    profile = [
        (FLANGE_IN + 0.3, bot), (FLANGE_OUT - 0.5, bot), (FLANGE_OUT, bot + 0.5),
        (FLANGE_OUT, flange_top - 0.2), (FLANGE_OUT - 0.2, flange_top),
        (fo + 0.25, flange_top), (fo, flange_top + 0.25),
        (fo, hook_z), (bo, hook_z - SLOPE * HOOK),     # hook face, same undercut as the lip
        (bo, tip_z), (fo + 0.1, top),                  # gentle lead-in
        (fi + 0.3, top), (fi, top - 0.3),
        (fi, flange_top + 0.2), (fi - 0.2, flange_top),
        (FLANGE_IN + 0.2, flange_top), (FLANGE_IN, flange_top - 0.2),
        (FLANGE_IN, gz1), (FLANGE_IN + gd, gz1), (FLANGE_IN + gd, gz0), (FLANGE_IN, gz0),   # for the click lock
        (FLANGE_IN, bot + 0.3),
    ]
    ring = revolve(profile, degrees=360.0 - GAP_DEG)
    return ring.rotate([0, 0, 180.0 + GAP_DEG / 2])   # gap faces +X


def lock_part():
    """Lock disc with the rivet pins and a sealed pocket for the NFC sticker."""
    bot, top = -FABRIC - FLANGE_T, -FABRIC
    disc = revolve([(0, bot), (LOCK_R - 0.3, bot), (LOCK_R, bot + 0.3), (LOCK_R, top), (0, top)])
    pocket = Manifold.cylinder(NFC_ROOM, NFC_POCKET, NFC_POCKET, 128).translate([0, 0, bot + NFC_FLOOR])
    pin = (Manifold.cylinder(BOSS_TOP + PIN_OVER - top - 0.5, PIN_D / 2, PIN_D / 2, 48)
           + Manifold.cylinder(0.5, PIN_D / 2, PIN_D * 0.18, 48).translate([0, 0, BOSS_TOP + PIN_OVER - top - 0.5]))
    return disc - pocket + at_pins(pin.translate([0, 0, top - 0.1]))


def lock_click_part():
    bot, top = -FABRIC - FLANGE_T, -FABRIC
    disc = revolve([(0, bot), (LOCK_R - 0.3, bot), (LOCK_R, bot + 0.3), (LOCK_R, top),
                    (CLICK_NFC_POCKET, top), (CLICK_NFC_POCKET, top - NFC_ROOM), (0, top - NFC_ROOM)])
    band_in = LOCK_R - TAB_BAND
    hz0, hz1 = LOCK_HOOK_Z
    for i in range(3):
        a = 120.0 * i + 30.0
        disc -= sector(band_in - TAB_SLOT, band_in, bot - 1, top + 1, a, a + TAB_DEG)      # frees the tab
        disc -= sector(band_in - TAB_SLOT, LOCK_R + 1, bot - 1, top + 1, a + TAB_DEG, a + TAB_DEG + 3)
        disc += revolve([(LOCK_R - 0.1, bot), (LOCK_R, bot), (LOCK_HOOK_R, hz0), (LOCK_HOOK_R, hz1),
                         (LOCK_R - 0.1, hz1)], degrees=14.0).rotate([0, 0, a + TAB_DEG - 16])
    return disc


def tag_click_part():
    return Manifold.cylinder(NFC_T, CLICK_NFC_TAG, CLICK_NFC_TAG, 128).translate([0, 0, -FABRIC - NFC_ROOM])


def lock_melted():
    """How the lock looks once the pins are melted into the countersinks (for the viewer)."""
    heads = at_pins(cone(BOSS_TOP - SINK_DEPTH, PIN_HOLE / 2, BOSS_TOP, SINK_D / 2))
    return lock_part().trim_by_plane([0, 0, -1], -BOSS_TOP) + heads


def tag_part():
    z = -FABRIC - FLANGE_T + NFC_FLOOR + 0.02
    return Manifold.cylinder(NFC_T, NFC_TAG, NFC_TAG, 128).translate([0, 0, z])


def fabric_path():
    """Mid-line of the fabric (r, z) when the ring is snapped in, for the viewer."""
    fo, fi, bo, hook_z, top = ring_geometry()
    fo, fi, bo = fo - PRELOAD, fi - PRELOAD, bo - PRELOAD
    h = FABRIC / 2
    hook_tip = hook_z - SLOPE * HOOK
    pts = [
        (0, -h), (fi - h - 0.3, -h), (fi - h, 0.0), (fi - h, top - 0.3),     # up the inside of the collar
        (fi + 0.1, top + h), (fo + 0.1, top + h),                             # over the tip
        (bo + 0.6 * h, hook_tip + 0.08 + 0.7 * h), (bo + h, hook_tip),        # down the lead-in
        (bo + 0.05, hook_tip - 0.6 * h), (LIP_R - 0.05, LIP_Z_IN + h),       # under the hook, over the lip
        (fo + h, LIP_Z_IN + h - 0.05), (fo + h, 0.1), (fo + h + 0.35, -h),    # down the slot, out flat
        (R_OUT, -h),
    ]
    return [[round(r, 3), round(z, 3)] for r, z in pts]


def radial_shift(part, dr):
    def warp(v):
        v = np.array(v, dtype=np.float64)
        r = np.hypot(v[:, 0], v[:, 1])
        k = (r + dr) / np.maximum(r, 1e-9)
        v[:, 0] *= k
        v[:, 1] *= k
        return v
    return part.warp_batch(warp)


def sector(r0, r1, z0, z1, a0, a1):
    return revolve([(r0, z0), (r1, z0), (r1, z1), (r0, z1)], degrees=a1 - a0).rotate([0, 0, a0])


def groove_wall(z):
    return GROOVE_IN - 0.8 * max(0.0, 1.0 - z)


def check(body, ring, cap, lock):
    fo, fi, bo, hook_z, top = ring_geometry()
    ok = True

    def line(label, value, good):
        nonlocal ok
        ok &= good
        print(f"  {'ok ' if good else 'BAD'} {label}: {value}")

    print("fit check")
    for name, part in (("base", body), ("ring", ring), ("cap", cap), ("lock", lock)):
        line(f"{name} watertight", part.status().name, part.status().name == "NoError" and part.volume() > 0)
    seated = radial_shift(ring, -PRELOAD)       # ring squeezed by the fabric when worn
    gap = body.min_gap(seated, 2.0)
    line(f"room for {FABRIC} mm fabric everywhere", f"min gap {gap:.2f} mm", gap >= FABRIC - 0.03)

    print("  ring through the fabric:")
    c = (FLANGE_OUT - FLANGE_IN) / 2
    mid = (FLANGE_IN + FLANGE_OUT) / 2
    gap_mm = math.radians(GAP_DEG) * (fo - COLLAR / 2)
    for t in FABRIC_RANGE:
        squeeze = bo + t - LIP_R                 # to get hook + fabric past the lip
        room = fi - squeeze - t - groove_wall(top - LIP_Z_IN - 0.3)
        strain = c * squeeze / mid ** 2
        seat = max(0.0, fo + t - LIP_R)          # how much the fabric keeps the ring squeezed
        hold = bo - seat + t - LIP_R
        spare = CHAMBER_OUT - (bo - seat + t)
        give = FLANGE_IN - seat - LOCK_R         # how far the lock still lets the ring shrink
        line(f"  fabric {t}: squeeze {squeeze:.2f}, room inside {room:.2f}, cut closes "
             f"{2 * math.pi * squeeze:.1f}/{gap_mm:.1f} mm, bend {strain * 100:.1f} %",
             "ok" if room >= 0.1 and gap_mm > 2 * math.pi * squeeze + 0.8 and strain < 0.02 else "no",
             room >= 0.1 and gap_mm > 2 * math.pi * squeeze + 0.8 and strain < 0.02)
        line(f"  fabric {t}: hook {hold:.2f} mm behind the lip, {hold - give:.2f} mm even if squeezed "
             f"against the lock, {spare:.2f} mm spare in the undercut", "ok",
             hold >= 0.75 and 0.1 <= give and hold - give >= 0.3 and spare >= 0.25)

    print("  rivets:")
    clash = (lock ^ body).volume()
    line("  pins run free in their holes", f"{clash:.4f} mm3", clash < 1e-3)
    clash = (lock ^ seated).volume()
    line("  lock sits inside the ring", f"{clash:.4f} mm3", clash < 1e-3)
    melt = math.pi * (PIN_D / 2) ** 2 * PIN_OVER
    sink = math.pi * SINK_DEPTH / 3 * ((SINK_D / 2) ** 2 + SINK_D / 2 * PIN_HOLE / 2 + (PIN_HOLE / 2) ** 2) \
        - math.pi * (PIN_D / 2) ** 2 * SINK_DEPTH
    line("  melted head fills the countersink", f"{melt:.2f} of {sink:.2f} mm3", 0.6 * sink <= melt <= 1.6 * sink)
    line("  pins clear the NFC pocket", f"{PIN_R - PIN_D / 2 - NFC_POCKET:.2f} mm", PIN_R - PIN_D / 2 - NFC_POCKET >= 0.5)

    print("  click lock (variant 2):")
    lock_c = lock_click_part()
    line("  watertight", lock_c.status().name, lock_c.status().name == "NoError")
    tab_len = math.radians(TAB_DEG) * (LOCK_R - TAB_BAND / 2)
    for t in FABRIC_RANGE:
        hole = FLANGE_IN - max(0.0, fo + t - LIP_R)
        grip, bend = LOCK_HOOK_R - hole, (LOCK_HOOK_R - hole) / (TAB_SLOT - 0.1)
        strain = 1.5 * TAB_BAND * grip / tab_len ** 2
        line(f"  fabric {t}: tab hook {grip:.2f} mm in the ring, uses {bend * 100:.0f} % of its slot, bend {strain * 100:.1f} %",
             "ok", grip >= 0.25 and bend <= 1.0 and strain < 0.02)
    line("  NFC Ø20 pocket rim", f"{LOCK_R - CLICK_NFC_POCKET:.2f} mm", LOCK_R - CLICK_NFC_POCKET >= 0.3)

    print("  NFC sealed in the lock:")
    cover = FLANGE_T - NFC_FLOOR - NFC_ROOM
    line("  plastic under / over the sticker", f"{NFC_FLOOR:.1f} / {cover:.1f} mm", NFC_FLOOR >= 0.399 and cover >= 0.399)
    line("  room for the sticker", f"{NFC_ROOM - NFC_T:.2f} mm spare in height, {NFC_POCKET - NFC_TAG:.2f} around",
         NFC_ROOM - NFC_T >= 0.03 and NFC_POCKET - NFC_TAG >= 0.15)
    closed = lock.genus() == -1                  # outer skin + the closed pocket inside
    line("  pocket fully closed (a void inside the lock)", f"genus {lock.genus()}", closed)
    print(f"    pause the lock print at {NFC_PAUSE:.1f} mm, drop the sticker in, resume")
    print(f"    sticker to cap face: {CAP_TOP + FABRIC + FLANGE_T - NFC_FLOOR - NFC_T:.1f} mm")

    print("  cap on the base:")
    clash = (cap ^ body).volume()
    line("  screwed down, nothing overlaps", f"{clash:.4f} mm3", clash < 1e-3)
    boss = body ^ Manifold.cylinder(2, 15, 15, SEG).translate([0, 0, BASE_TOP + 0.05])
    play = cap.min_gap(boss, 1.0)
    line("  thread play", f"{play:.2f} mm", 0.1 <= play <= 0.3)
    lifted = cap.translate([0, 0, THREAD_CLR + 0.1]) ^ body   # pulled up past the play: teeth run into teeth
    around = sum((lifted ^ sector(10, 16, 0, 6, 30 * k, 30 * k + 30)).volume() > 0.005 for k in range(12))
    line("  pulling does not lift it off", f"thread catches in {around} of 12 sectors around", around >= 11)
    turn = 360.0 * (BOSS_TOP - BASE_TOP) / THREAD_LEAD
    line("  turn from touch to tight", f"{turn:.0f}°", turn <= 220)
    lead_angle = math.degrees(math.atan(THREAD_LEAD / (2 * math.pi * THREAD_ROOT)))
    line("  thread holds by friction", f"lead angle {lead_angle:.1f}°", lead_angle < 5)
    line("  cap face over the thread", f"{CAP_TOP - SOCKET_TOP:.2f} mm", CAP_TOP - SOCKET_TOP >= 0.8)
    text = text_part()
    bb = text.bounding_box()
    wall = R_OUT - TEXT_DEPTH - THREAD_CREST - THREAD_CLR
    line(f"  '{TEXT}' on the side", f"{bb[5] - bb[2]:.1f} mm tall, {TEXT_DEPTH} deep, z {bb[2]:.1f}-{bb[5]:.1f}, "
         f"{wall:.1f} mm of wall behind it", wall >= 2.0 and bb[2] >= BASE_TOP + 0.2 and bb[5] <= CAP_TOP - CAP_EDGE)
    return ok


def as_arrays(part):
    mesh = part.to_mesh()
    return np.asarray(mesh.vert_properties[:, :3], np.float32), np.asarray(mesh.tri_verts, np.uint32)


def write_stl(path, verts, tris, face_down=False):
    v = verts.astype(np.float64)
    if face_down:                                 # turned over about X, as it goes on the bed
        v = v * [1, -1, -1]
    v = v - [0, 0, v[:, 2].min()]
    t = v[tris]
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    rec = np.zeros(len(tris), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["n"], rec["v"] = n, t
    with open(path, "wb") as f:
        f.write(b"Libre diabetica, mm".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        f.write(rec.tobytes())


def packed(verts, tris):
    return {"v": base64.b64encode(np.ascontiguousarray(verts, np.float32).tobytes()).decode(),
            "i": base64.b64encode(np.ascontiguousarray(tris, np.uint32).tobytes()).decode(),
            "nv": int(len(verts)), "ni": int(tris.size)}


def main():
    body, ring, cap, lock = body_part(), ring_part(), cap_part(), lock_part()
    if not check(body, ring, cap, lock):
        raise SystemExit("parts do not fit, nothing written")

    body_c, lock_c = body_click_part(), lock_click_part()
    shown = {"cap": cap, "body": body, "ring": ring, "lock": lock_melted(), "lock_print": lock,
             "tag": tag_part(),
             "body_click": body_c, "lock_click": lock_c, "tag_click": tag_click_part()}
    data = {k: packed(*as_arrays(p)) for k, p in shown.items()}
    data["fit"] = {"fabric": FABRIC, "preload": PRELOAD, "hook": HOOK, "gap_deg": GAP_DEG,
                   "lead": THREAD_LEAD, "turn": 360.0 * (BOSS_TOP - BASE_TOP) / THREAD_LEAD, "nfc_pause": NFC_PAUSE}
    data["fabric"] = fabric_path()
    html = PAGE.read_text(encoding="utf-8")
    block = re.compile(r'(<script type="application/json" id="mesh">)(.*?)(</script>)', re.S)
    payload = json.dumps(data, separators=(",", ":"))
    PAGE.write_text(block.sub(lambda m: m.group(1) + payload + m.group(3), html, count=1), encoding="utf-8")

    STL_DIR.mkdir(exist_ok=True)
    for old in STL_DIR.rglob("*.stl"):
        old.unlink()
    (STL_DIR / "click").mkdir(exist_ok=True)
    for name, part, flip in (("1_cap", cap, True), ("2_base", body, False), ("3_ring", ring, False), ("4_lock", lock, False),
                             ("click/libre_2_base_click", body_c, False), ("click/libre_4_lock_click", lock_c, False)):
        path = STL_DIR / (f"{name}.stl" if "/" in name else f"libre_{name}.stl")
        write_stl(path, *as_arrays(part), face_down=flip)
        print(f"  {path.relative_to(HERE)}: {part.volume() / 1000:.2f} cm3, ~{part.volume() / 1000 * 1.27:.1f} g")


if __name__ == "__main__":
    main()
