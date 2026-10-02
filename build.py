#!/usr/bin/env python3
"""Construit dist/phenix-tickets-lot1.html : une version autonome de la maquette
(CSS, JavaScript et images intégrés) qu'on peut envoyer par e-mail ou publier.

Usage : python3 build.py   (Python 3, aucune dépendance)
"""
import base64
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent
SORTIE = RACINE / "dist" / "phenix-tickets-lot1.html"
TYPES = {".png": "image/png", ".gif": "image/gif", ".svg": "image/svg+xml", ".jpg": "image/jpeg"}


def data_uri(chemin_relatif: str) -> str:
    f = RACINE / chemin_relatif
    return "data:%s;base64,%s" % (TYPES[f.suffix.lower()], base64.b64encode(f.read_bytes()).decode("ascii"))


def integrer_images(texte: str) -> str:
    return re.sub(r"assets/img/[A-Za-z0-9_.\-]+", lambda m: data_uri(m.group(0)), texte)


def main() -> None:
    html = (RACINE / "index.html").read_text(encoding="utf-8")
    html = re.sub(
        r'<link rel="stylesheet" href="([^"]+)">',
        lambda m: "<style>\n%s\n</style>" % (RACINE / m.group(1)).read_text(encoding="utf-8"),
        html,
    )
    html = re.sub(
        r'<script src="([^"]+)"></script>',
        lambda m: "<script>\n%s\n</script>" % (RACINE / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script"),
        html,
    )
    html = integrer_images(html)
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(html, encoding="utf-8")
    print("OK : %s (%d Ko)" % (SORTIE.relative_to(RACINE), SORTIE.stat().st_size // 1024))


if __name__ == "__main__":
    main()
