# Team photos

Drop a `.jpg` per member into this directory. The frontend picks them up
automatically — no code change needed. If a file is missing, the avatar
falls back to a gradient + initials disc.

## Filename convention

Each photo's filename is the member's display name, lowercased,
non-alphanumeric stripped, spaces replaced with `-`. The slug is computed
by `slugifyName()` in `Frontend/src/features/landing/data/team.ts`.

| Display name              | Filename                         |
| ------------------------- | -------------------------------- |
| Ruhina Begum Shaik        | `ruhina-begum-shaik.jpg`         |
| Sagar Chedde              | `sagar-chedde.jpg`               |
| Muhib Shaik               | `muhib-shaik.jpg`                |
| Rehman Shaik              | `rehman-shaik.jpg`               |
| Rasool Shaik              | `rasool-shaik.jpg`               |
| Afrid Sk                  | `afrid-sk.jpg`                   |
| Matin Syed                | `matin-syed.jpg`                 |
| Tejaswini Kommi           | `tejaswini-kommi.jpg`            |
| Chand Basha               | `chand-basha.jpg`                |
| Asif Mohammad Shaik       | `asif-mohammad-shaik.jpg`        |
| Fazil Ahmed Syed          | `fazil-ahmed-syed.jpg`           |
| Afroz Ahmed Shaik         | `afroz-ahmed-shaik.jpg`          |
| Meera Mohiddin Shaik      | `meera-mohiddin-shaik.jpg`       |
| Rajashekar Vanjeti        | `rajashekar-vanjeti.jpg`         |
| Adnan Shaik               | `adnan-shaik.jpg`                |
| Sayad Soheal              | `sayad-soheal.jpg`               |
| Abdul Hafeez Syed         | `abdul-hafeez-syed.jpg`          |
| Sanavulla Shaik           | `sanavulla-shaik.jpg`            |
| Irfan Mohammed            | `irfan-mohammed.jpg`             |
| Shaik Zakeer              | `shaik-zakeer.jpg`               |
| Jayanth                   | `jayanth.jpg`                    |
| Hussain Khan              | `hussain-khan.jpg`               |
| Ameen Sahil Shaik         | `ameen-sahil-shaik.jpg`          |

## Image specs

- **Aspect**: 1:1 (square). The avatar component crops to a circle.
- **Size**: ≥ 256×256, ideally 512×512. Larger is fine — `<img>` is downscaled.
- **Format**: JPG preferred. PNG/WEBP also work — change the extension in
  the URL if you switch (or rename one-time after dropping in).
- **Crop**: face centred, head + shoulders.

## Adding a new member

1. Add a row to `LEADERSHIP`, `ENGINEERS`, or `ASSOCIATES` in
   `Frontend/src/features/landing/data/team.ts`.
2. Save their photo in this directory using the slug rule above.

## Overriding the slug rule

If a member needs a non-default filename (e.g. `priya-2024.jpg`), set
`photo: "/team/priya-2024.jpg"` directly on the team-data row — that
takes precedence over the auto-generated `defaultPhotoFor()` path.
