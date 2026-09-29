#!/usr/bin/env python3
"""Rebuild the printable parts of the Libre diabetica replica.

Regenerates the clear body and the clip ring, checks that they fit together
through the fabric, adds the glue key between cap and body, writes print-ready
STL files to ./stl and refreshes the meshes embedded in Libre_Diabetica_3D.html.
The look of the white cap (dome, hub, engraving) and the NFC tag are kept as
they are in the page; only a rib is added under the cap.

    pip install manifold3d numpy
    python3 build_parts.py

All sizes are millimetres, Z up, z = 0 is the underside of the body, which is
where the outer face of the fabric sits.
"""
import base64
import json
import math
import re
import struct
from pathlib import Path

import numpy as np
from manifold3d import CrossSection, Manifold, Mesh

HERE = Path(__file__).resolve().parent
PAGE = HERE / "Libre_Diabetica_3D.html"
STL_DIR = HERE / "stl"

FABRIC = 0.5          # t-shirt jersey squeezed in the clamp (designed for 0.3 ... 0.6)
FABRIC_RANGE = (0.3, 0.5, 0.6)

# body: Libre 1:1, Ø35 x 2.8, ribbed side, NFC pocket on top
R_OUT, RIBS, RIB_MID, RIB_AMP = 17.5, 96, 17.41, 0.09
STEP_R, STEP_Z, TOP_Z = 16.9, 2.4, 2.8
POCKET_R, POCKET_Z = 12.8, 2.2

# groove under the body that the ring snaps into
GROOVE_IN = 12.8      # inner wall, widened towards the opening so the ring has room to squeeze
GROOVE_TOP = 2.0      # ceiling, leaves 0.8 mm under the cap
CHAMBER_OUT = 16.4    # outer wall of the undercut, leaves ~0.9 mm rib wall
LIP_R = 15.35         # the lip the ring hooks behind
LIP_Z_IN, LIP_Z_OUT = 0.5, 0.39   # lip top slopes down outwards (dovetail), so a pull locks harder
SLOPE = (LIP_Z_IN - LIP_Z_OUT) / 1.05   # ~6°, the hook face copies it

# glue key: a rib under the cap sits in a groove on top of the body. It centres the
# cap, holds a ring of glue and takes sideways knocks in shear instead of peel
KEY_IN, KEY_OUT = 14.4, 15.0     # rib under the cap
KEY_H = 0.2
GLUE = 0.1                       # glue gap around the rib
KEY_DEPTH = KEY_H + GLUE         # groove in the body, leaves 0.5 mm over the ring groove

# FDM cap: same outline, but a flat face so it prints face down on the bed (the smoothest
# surface FDM can give), a 45° edge instead of the round, no 0.15 mm engraving (a 0.4 mm
# nozzle cannot draw it) and FDM clearances
CAP_TOP = 4.99
FDM_RIB = 0.5                    # 0.15 mm glue gap each side in the body groove
FDM_SKIRT_IN = 17.1              # 0.2 mm around the body step

# split clip ring (worn inside the shirt), modelled as printed = relaxed
PRELOAD = 0.2         # ring presses the fabric outward against the lip by this much
COLLAR = 1.0          # collar wall
HOOK = 0.55           # how far the hook reaches behind the lip, plastic on plastic
FLANGE_IN, FLANGE_OUT = 11.0, 16.5
FLANGE_T = 1.2
GAP_DEG = 28.0        # cut in the ring, closes when it is squeezed through the lip


def body_part():
    lip_foot = LIP_R + 0.25
    profile = [
        (0, 0), (GROOVE_IN - 0.8, 0), (GROOVE_IN, 1.0), (GROOVE_IN, GROOVE_TOP),
        (CHAMBER_OUT, GROOVE_TOP), (CHAMBER_OUT, LIP_Z_OUT), (LIP_R, LIP_Z_IN),
        (LIP_R, 0.25), (lip_foot, 0), (17.2, 0), (R_OUT, 0.3), (R_OUT, STEP_Z),
        (STEP_R, STEP_Z), (STEP_R, TOP_Z),
        (KEY_OUT + GLUE, TOP_Z), (KEY_OUT + GLUE, TOP_Z - KEY_DEPTH),       # glue groove
        (KEY_IN - GLUE, TOP_Z - KEY_DEPTH), (KEY_IN - GLUE, TOP_Z),
        (POCKET_R, TOP_Z), (POCKET_R, POCKET_Z), (0, POCKET_Z),
    ]
    solid = Manifold.revolve(CrossSection([profile]), circular_segments=RIBS * 4)

    def ribs(v):
        v = np.array(v, dtype=np.float64)
        r = np.hypot(v[:, 0], v[:, 1])
        wall = (r > R_OUT - 0.02) & (v[:, 2] > 0.29)
        a = np.arctan2(v[wall, 1], v[wall, 0])
        rr = RIB_MID + RIB_AMP * np.cos(RIBS * a)
        v[wall, 0] = rr * np.cos(a)
        v[wall, 1] = rr * np.sin(a)
        return v

    return solid.warp_batch(ribs)


def cap_part(cap):
    """The cap from the page with the glue rib under it (an older rib is replaced)."""
    under = Manifold.cylinder(TOP_Z, STEP_R + 0.05, STEP_R + 0.05, 256)   # nothing of the cap lives here
    rib = [(KEY_IN + 0.05, TOP_Z - KEY_H), (KEY_OUT - 0.05, TOP_Z - KEY_H), (KEY_OUT, TOP_Z - KEY_H + 0.05),
           (KEY_OUT, TOP_Z + 0.05), (KEY_IN, TOP_Z + 0.05), (KEY_IN, TOP_Z - KEY_H + 0.05)]
    rib = Manifold.revolve(CrossSection([rib]), circular_segments=256)
    old, new = cap ^ under, rib ^ under
    if abs(old.volume() - new.volume()) < 1e-4 and (old - new).volume() < 1e-4:
        return cap                                                        # already has this rib
    return (cap - under) + rib


def cap_fdm_part():
    profile = [
        (0, TOP_Z), (FDM_SKIRT_IN, TOP_Z), (FDM_SKIRT_IN, STEP_Z), (R_OUT, STEP_Z),
        (R_OUT, CAP_TOP - 0.8), (R_OUT - 0.8, CAP_TOP),             # 45° edge, no overhang face down
        (2.5, CAP_TOP), (2.5, CAP_TOP - 0.5), (0.8, CAP_TOP - 0.5), (0.8, CAP_TOP - 1.1), (0, CAP_TOP - 1.1),
    ]
    mid = (KEY_IN + KEY_OUT) / 2
    rib = [(mid - FDM_RIB / 2, TOP_Z - KEY_H), (mid + FDM_RIB / 2, TOP_Z - KEY_H),
           (mid + FDM_RIB / 2, TOP_Z + 0.05), (mid - FDM_RIB / 2, TOP_Z + 0.05)]
    return (Manifold.revolve(CrossSection([profile]), circular_segments=256)
            + Manifold.revolve(CrossSection([rib]), circular_segments=256))


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
    profile = [
        (FLANGE_IN + 0.3, bot), (FLANGE_OUT - 0.5, bot), (FLANGE_OUT, bot + 0.5),
        (FLANGE_OUT, flange_top - 0.2), (FLANGE_OUT - 0.2, flange_top),
        (fo + 0.25, flange_top), (fo, flange_top + 0.25),
        (fo, hook_z), (bo, hook_z - SLOPE * HOOK),     # hook face, same undercut as the lip
        (bo, tip_z), (fo + 0.1, top),                  # ~45° lead-in
        (fi + 0.3, top), (fi, top - 0.3),
        (fi, flange_top + 0.2), (fi - 0.2, flange_top),
        (FLANGE_IN + 0.2, flange_top), (FLANGE_IN, flange_top - 0.2),
        (FLANGE_IN, bot + 0.3),
    ]
    ring = Manifold.revolve(CrossSection([profile]), circular_segments=256,
                            revolve_degrees=360.0 - GAP_DEG)
    return ring.rotate([0, 0, 180.0 + GAP_DEG / 2])   # gap faces +X


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


def check(body, ring, cap, cap_fdm):
    fo, fi, bo, hook_z, top = ring_geometry()
    ok = True

    def line(label, value, good):
        nonlocal ok
        ok &= good
        print(f"  {'ok ' if good else 'BAD'} {label}: {value}")

    print("fit check")
    line("body watertight", body.status().name, body.status().name == "NoError")
    line("ring watertight", ring.status().name, ring.status().name == "NoError")
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
        line("  squeezes through the lip", f"{squeeze:.2f} mm, spare inside {room:.2f} mm", room >= -0.05)
        line("  cut in the ring", f"closes {2 * math.pi * squeeze:.1f} of {gap_mm:.1f} mm", gap_mm > 2 * math.pi * squeeze + 0.8)
        strain = c * squeeze / mid ** 2
        line("  bending strain while snapping", f"{strain * 100:.1f} %", strain < 0.02)
        seat = max(0.0, fo + t - LIP_R)          # how much the fabric keeps the ring squeezed
        hold = bo - seat + t - LIP_R
        line("  hook depth behind the lip", f"{hold:.2f} mm", hold >= 0.5)
        spare = CHAMBER_OUT - (bo - seat + t)
        line("  hook + fabric fit in the undercut", f"spare {spare:.2f} mm", spare >= 0.25)
    print(f"  no fabric at all: hook still {bo - LIP_R:.2f} mm behind the lip")
    print("  cap on body:")
    line("  cap watertight", cap.status().name, cap.status().name == "NoError")
    clash = (cap ^ body).volume()
    line("  cap and body do not overlap", f"{clash:.4f} mm3", clash < 1e-3)
    roof = TOP_Z - KEY_DEPTH - GROOVE_TOP
    line("  body under the glue groove", f"{roof:.2f} mm over the ring groove", roof >= 0.45)
    flat = math.pi * (STEP_R ** 2 - POCKET_R ** 2) - math.pi * ((KEY_OUT + GLUE) ** 2 - (KEY_IN - GLUE) ** 2)
    key = 2 * math.pi * (KEY_IN + KEY_OUT) * KEY_H + math.pi * (KEY_OUT ** 2 - KEY_IN ** 2)
    skirt = 2 * math.pi * 17.0 * (TOP_Z - STEP_Z)
    area = flat + key + skirt
    line("  glue area", f"{area:.0f} mm2 (was 426), at 2 MPa ~{area * 2 / 9.81:.0f} kgf", area > 426)
    print("  FDM cap on body:")
    line("  watertight", cap_fdm.status().name, cap_fdm.status().name == "NoError")
    clash = (cap_fdm ^ body).volume()
    line("  does not overlap the body", f"{clash:.4f} mm3", clash < 1e-3)
    line("  glue gap beside the rib", f"{(KEY_OUT - KEY_IN + 2 * GLUE - FDM_RIB) / 2:.2f} mm", (KEY_OUT - KEY_IN + 2 * GLUE - FDM_RIB) / 2 >= 0.149)
    line("  skirt clearance", f"{FDM_SKIRT_IN - STEP_R:.2f} mm", FDM_SKIRT_IN - STEP_R >= 0.199)
    return ok


def as_arrays(part):
    mesh = part.to_mesh()
    return np.asarray(mesh.vert_properties[:, :3], np.float32), np.asarray(mesh.tri_verts, np.uint32)


def write_stl(path, verts, tris):
    v = verts.astype(np.float64)
    v = v - [0, 0, v[:, 2].min()]                 # sit on the build plate
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


def unpack(p):
    v = np.frombuffer(base64.b64decode(p["v"]), np.float32).reshape(-1, 3)
    i = np.frombuffer(base64.b64decode(p["i"]), np.uint32).reshape(-1, 3)
    return v, i


def main():
    html = PAGE.read_text(encoding="utf-8")
    block = re.compile(r'(<script type="application/json" id="mesh">)(.*?)(</script>)', re.S)
    data = json.loads(block.search(html).group(2))
    v, i = unpack(data["cap"])
    body, ring = body_part(), ring_part()
    cap = cap_part(Manifold(Mesh(vert_properties=np.array(v, np.float32), tri_verts=np.array(i, np.uint32))))
    cap_fdm = cap_fdm_part()
    if not check(body, ring, cap, cap_fdm):
        raise SystemExit("parts do not fit, nothing written")

    data["cap"] = packed(*as_arrays(cap))
    data["body"] = packed(*as_arrays(body))
    data["ring"] = packed(*as_arrays(ring))
    data["cap_fdm"] = packed(*as_arrays(cap_fdm.rotate([180, 0, 0])))   # stored face down, as printed
    data["fit"] = {"fabric": FABRIC, "preload": PRELOAD, "hook": HOOK, "gap_deg": GAP_DEG}
    data["fabric"] = fabric_path()
    payload = json.dumps(data, separators=(",", ":"))
    PAGE.write_text(block.sub(lambda m: m.group(1) + payload + m.group(3), html, count=1), encoding="utf-8")

    STL_DIR.mkdir(exist_ok=True)
    for name, key in (("1_cap_white", "cap"), ("1_cap_white_FDM", "cap_fdm"), ("2_body_clear", "body"), ("3_ring_inside", "ring")):
        write_stl(STL_DIR / f"libre_{name}.stl", *unpack(data[key]))
    print("written:", ", ".join(sorted(p.name for p in STL_DIR.glob("*.stl"))))


if __name__ == "__main__":
    main()
