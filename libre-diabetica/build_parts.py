#!/usr/bin/env python3
"""Build the printable parts of the Libre diabetica replica (FDM, PETG).

    cap   white, smooth face, screws onto the base (3-start thread, a third of a
          turn), so fronts can be swapped
    base  clear, ribbed like a Libre, sits on the outside of the sleeve
    ring  split clip ring inside the shirt, snaps into the base through the fabric
    lock  disc in the middle of the ring, so the ring can no longer be squeezed
          out; it holds the NFC sticker, under the fabric

The base goes on for good in one of two ways:
    click   the lock clicks into the ring (no holes, no glue; add glue to make it final)
    rivet   the lock has four pins that go through the fabric and the base and are
            melted over on top of the base with a soldering iron

Checks the fit, writes print-ready STL files (already turned the way they go on
the bed) to ./stl and refreshes the meshes embedded in Libre_Diabetica_3D.html.

    pip install manifold3d numpy
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
from manifold3d import CrossSection, Manifold, OpType

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
LOCK_GROOVE = (-1.3, -0.9, 0.5)   # z from, z to, depth of the groove in the flange's inner wall

# lock disc: fills the middle of the ring so the ring cannot shrink any more
LOCK_R = 10.55        # a hair under the ring's hole with the thickest fabric
TAB_BAND, TAB_SLOT, TAB_DEG = 1.2, 0.8, 60.0
LOCK_HOOK_R = 11.25   # hook on each tab, clicks into the flange groove
LOCK_HOOK_Z = (-1.2, -1.0)

# cap on a thread: 3 starts like a bottle cap, a third of a turn from touch to tight,
# fine enough that the teeth catch all the way round; flanks ~35° off vertical print clean
THREAD_ROOT, THREAD_CREST = 13.0, 13.6
THREAD_LEAD, THREAD_STARTS = 3.6, 3
THREAD_CLR = 0.2      # radial play for FDM, the teeth still overlap by 0.4 mm
BOSS_TOP = 3.8
CAP_TOP, CAP_EDGE = 5.0, 0.8
SOCKET_TOP = 4.0      # 0.2 mm over the boss

# NFC sticker in the top of the lock disc, under the fabric: Ø20 in the click lock,
# Ø15 in the rivet lock (the pins run around it)
NFC_POCKET = {"click": 10.2, "rivet": 7.7}
NFC_TAG = {"click": 10.0, "rivet": 7.5}
NFC_DEPTH, NFC_T = 0.4, 0.35

# rivet lock: pins through fabric and base, melted into countersinks on top of the boss
PIN_R, PIN_D, PIN_N = 9.3, 1.4, 4
PIN_HOLE = 1.8
PIN_OVER = 1.0        # sticks out over the boss, melted flat into the countersink
SINK_D, SINK_DEPTH = 3.0, 0.5


def revolve(profile, segments=SEG, degrees=360.0):
    return Manifold.revolve(CrossSection([profile]), circular_segments=segments, revolve_degrees=degrees)


def cone(z0, r0, z1, r1):
    return Manifold.cylinder(z1 - z0, r0, r1, SEG).translate([0, 0, z0])


def body_part():
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


def cap_part():
    outer = revolve([(0, BASE_TOP), (R_OUT - 0.2, BASE_TOP), (R_OUT, BASE_TOP + 0.2),
                     (R_OUT, CAP_TOP - CAP_EDGE), (R_OUT - CAP_EDGE, CAP_TOP), (0, CAP_TOP)])
    z0 = BASE_TOP - 0.05                        # same start and phase as the boss
    socket = thread(THREAD_CLR, SOCKET_TOP - z0).translate([0, 0, z0])
    mouth = THREAD_CREST + THREAD_CLR           # 45° mouth chamfer, leaves the thread itself alone
    lead_in = cone(BASE_TOP - 0.1, mouth + 0.4, BASE_TOP + 0.3, mouth)
    return outer - socket - lead_in


def tag_part(kind="click"):
    z = -FABRIC - NFC_DEPTH
    return Manifold.cylinder(NFC_T, NFC_TAG[kind], NFC_TAG[kind], 128).translate([0, 0, z])


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
        (FLANGE_IN, gz1), (FLANGE_IN + gd, gz1), (FLANGE_IN + gd, gz0), (FLANGE_IN, gz0),   # groove for the lock
        (FLANGE_IN, bot + 0.3),
    ]
    ring = revolve(profile, degrees=360.0 - GAP_DEG)
    return ring.rotate([0, 0, 180.0 + GAP_DEG / 2])   # gap faces +X


def sector(r0, r1, z0, z1, a0, a1):
    return revolve([(r0, z0), (r1, z0), (r1, z1), (r0, z1)], degrees=a1 - a0).rotate([0, 0, a0])


def lock_disc(kind):
    bot, top = -FABRIC - FLANGE_T, -FABRIC
    pocket = NFC_POCKET[kind]
    return revolve([(0, bot), (LOCK_R - 0.3, bot), (LOCK_R, bot + 0.3), (LOCK_R, top),
                    (pocket, top), (pocket, top - NFC_DEPTH), (0, top - NFC_DEPTH)])


def lock_part():
    bot, top = -FABRIC - FLANGE_T, -FABRIC
    disc = lock_disc("click")
    band_in = LOCK_R - TAB_BAND
    hz0, hz1 = LOCK_HOOK_Z
    for i in range(3):
        a = 120.0 * i + 30.0
        disc -= sector(band_in - TAB_SLOT, band_in, bot - 1, top + 1, a, a + TAB_DEG)      # frees the tab
        disc -= sector(band_in - TAB_SLOT, LOCK_R + 1, bot - 1, top + 1, a + TAB_DEG, a + TAB_DEG + 3)
        hook = revolve([(LOCK_R - 0.1, bot), (LOCK_R, bot), (LOCK_HOOK_R, hz0), (LOCK_HOOK_R, hz1),
                        (LOCK_R - 0.1, hz1)], degrees=14.0).rotate([0, 0, a + TAB_DEG - 16])
        disc += hook
    return disc


def pins(r, z0, z1, tip=0.0):
    out = []
    for i in range(PIN_N):
        a = math.radians(45 + 90 * i)
        pin = Manifold.cylinder(z1 - z0 - tip, r, r, 48).translate([0, 0, z0])
        if tip:
            pin += Manifold.cylinder(tip, r, r * 0.35, 48).translate([0, 0, z1 - tip])
        out.append(pin.translate([PIN_R * math.cos(a), PIN_R * math.sin(a), 0]))
    return Manifold.batch_boolean(out, OpType.Add)


def lock_rivet_part():
    """Plain lock disc with pins: pushed through the fabric and the base, then melted over."""
    return lock_disc("rivet") + pins(PIN_D / 2, -FABRIC - 0.1, BOSS_TOP + PIN_OVER, tip=0.5)


def body_rivet_part(body):
    holes = pins(PIN_HOLE / 2, -1, BOSS_TOP + 1)
    sinks = []
    for i in range(PIN_N):
        a = math.radians(45 + 90 * i)
        sinks.append(cone(BOSS_TOP - SINK_DEPTH, PIN_HOLE / 2, BOSS_TOP + 0.01, SINK_D / 2)
                     .translate([PIN_R * math.cos(a), PIN_R * math.sin(a), 0]))
    return body - holes - Manifold.batch_boolean(sinks, OpType.Add)


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


def groove_wall(z):
    return GROOVE_IN - 0.8 * max(0.0, 1.0 - z)


def check(body, ring, cap, lock, body_rivet, lock_rivet):
    fo, fi, bo, hook_z, top = ring_geometry()
    ok = True

    def line(label, value, good):
        nonlocal ok
        ok &= good
        print(f"  {'ok ' if good else 'BAD'} {label}: {value}")

    print("fit check")
    for name, part in (("base", body), ("ring", ring), ("cap", cap), ("lock", lock),
                       ("rivet base", body_rivet), ("rivet lock", lock_rivet)):
        line(f"{name} watertight", part.status().name, part.status().name == "NoError" and part.volume() > 0)
    seated = radial_shift(ring, -PRELOAD)       # ring squeezed by the fabric when worn
    gap = body.min_gap(seated, 2.0)
    line(f"room for {FABRIC} mm fabric everywhere", f"min gap {gap:.2f} mm", gap >= FABRIC - 0.03)
    c = (FLANGE_OUT - FLANGE_IN) / 2
    mid = (FLANGE_IN + FLANGE_OUT) / 2
    gap_mm = math.radians(GAP_DEG) * (fo - COLLAR / 2)
    for t in FABRIC_RANGE:
        print(f"  fabric {t} mm:")
        squeeze = bo + t - LIP_R                 # to get hook + fabric past the lip
        room = fi - squeeze - t - groove_wall(top - LIP_Z_IN - 0.3)
        line("  ring squeezes through the lip", f"{squeeze:.2f} mm, spare inside {room:.2f} mm", room >= 0.1)
        line("  cut in the ring", f"closes {2 * math.pi * squeeze:.1f} of {gap_mm:.1f} mm", gap_mm > 2 * math.pi * squeeze + 0.8)
        strain = c * squeeze / mid ** 2
        line("  ring bending while snapping", f"{strain * 100:.1f} %", strain < 0.02)
        seat = max(0.0, fo + t - LIP_R)          # how much the fabric keeps the ring squeezed
        hold = bo - seat + t - LIP_R
        line("  hook depth behind the lip", f"{hold:.2f} mm", hold >= 0.75)
        spare = CHAMBER_OUT - (bo - seat + t)
        line("  hook + fabric fit in the undercut", f"spare {spare:.2f} mm", spare >= 0.25)
        hole = FLANGE_IN - seat
        give = hole - LOCK_R
        line("  lock disc leaves the ring room to shrink", f"{give:.2f} mm, hook keeps {hold - give:.2f} mm", 0.1 <= give and hold - give >= 0.3)
        grip = LOCK_HOOK_R - hole
        bend = grip / (TAB_SLOT - 0.1)
        line("  lock clicks into the ring", f"hook {grip:.2f} mm, tab uses {bend * 100:.0f} % of its slot", grip >= 0.25 and bend <= 1.0)
    tab_len = math.radians(TAB_DEG) * (LOCK_R - TAB_BAND / 2)
    worst = LOCK_HOOK_R - (FLANGE_IN - max(0.0, fo + FABRIC_RANGE[-1] - LIP_R))
    strain = 1.5 * TAB_BAND * max(worst, LOCK_HOOK_R - FLANGE_IN) / tab_len ** 2
    line("lock tab bending", f"{strain * 100:.1f} %", strain < 0.02)
    print(f"  no fabric at all: hook still {bo - LIP_R:.2f} mm behind the lip")

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
    line("  thread holds by friction (does not unscrew itself)", f"lead angle {lead_angle:.1f}°", lead_angle < 5)
    line("  cap face over the thread", f"{CAP_TOP - SOCKET_TOP:.2f} mm", CAP_TOP - SOCKET_TOP >= 0.8)

    print("  NFC under the fabric:")
    for kind in ("click", "rivet"):
        wall = LOCK_R - NFC_POCKET[kind]
        line(f"  Ø{2 * NFC_TAG[kind]:.0f} sticker in the {kind} lock", f"rim {wall:.2f} mm, {CAP_TOP + FABRIC + NFC_DEPTH:.1f} mm below the cap face",
             wall >= 0.3 and NFC_T <= NFC_DEPTH)
    print("  rivet version:")
    clash = (lock_rivet ^ body_rivet).volume()
    line("  pins run free in their holes", f"{clash:.4f} mm3", clash < 1e-3)
    clash = (lock_rivet ^ radial_shift(ring, -PRELOAD)).volume()
    line("  rivet lock sits inside the ring", f"{clash:.4f} mm3", clash < 1e-3)
    inner = PIN_R - PIN_D / 2 - NFC_POCKET["rivet"]
    line("  pins clear the sticker", f"{inner:.2f} mm", inner >= 0.5)
    melt = math.pi * (PIN_D / 2) ** 2 * PIN_OVER
    sink = math.pi * SINK_DEPTH / 3 * ((SINK_D / 2) ** 2 + SINK_D / 2 * PIN_HOLE / 2 + (PIN_HOLE / 2) ** 2) - math.pi * (PIN_D / 2) ** 2 * SINK_DEPTH
    line("  melted head fills the countersink", f"{melt:.2f} of {sink:.2f} mm3", 0.6 * sink <= melt <= 1.6 * sink)
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
    body_rivet, lock_rivet = body_rivet_part(body), lock_rivet_part()
    if not check(body, ring, cap, lock, body_rivet, lock_rivet):
        raise SystemExit("parts do not fit, nothing written")

    parts = {"cap": cap, "body": body, "ring": ring, "lock": lock, "tag": tag_part()}
    data = {k: packed(*as_arrays(p)) for k, p in parts.items()}
    data["fit"] = {"fabric": FABRIC, "preload": PRELOAD, "hook": HOOK, "gap_deg": GAP_DEG,
                   "lead": THREAD_LEAD, "turn": 360.0 * (BOSS_TOP - BASE_TOP) / THREAD_LEAD}
    data["fabric"] = fabric_path()
    html = PAGE.read_text(encoding="utf-8")
    block = re.compile(r'(<script type="application/json" id="mesh">)(.*?)(</script>)', re.S)
    payload = json.dumps(data, separators=(",", ":"))
    PAGE.write_text(block.sub(lambda m: m.group(1) + payload + m.group(3), html, count=1), encoding="utf-8")

    STL_DIR.mkdir(exist_ok=True)
    for old in STL_DIR.glob("*.stl"):
        old.unlink()
    parts.update(body_rivet=body_rivet, lock_rivet=lock_rivet)
    for name, key, flip in (("1_cap", "cap", True), ("2_base", "body", False), ("3_ring", "ring", False),
                            ("4_lock_click", "lock", False), ("2_base_RIVET", "body_rivet", False),
                            ("4_lock_RIVET", "lock_rivet", False)):
        write_stl(STL_DIR / f"libre_{name}.stl", *as_arrays(parts[key]), face_down=flip)
    print("written:", ", ".join(sorted(p.name for p in STL_DIR.glob("*.stl"))))
    for k in ("cap", "body", "ring", "lock", "lock_rivet"):
        print(f"  {k}: {parts[k].volume() / 1000:.2f} cm3, ~{parts[k].volume() / 1000 * 1.27:.1f} g PETG")


if __name__ == "__main__":
    main()
