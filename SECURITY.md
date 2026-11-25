# Security

FossFitness keeps people's health data, so security problems are taken seriously.

## Reporting a problem

Please **don't open a public issue** for a security problem. Report it privately through GitHub instead:
on the repository page, open the **Security** tab and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and which app version you tested. You'll get a reply as soon as the
maintainer can, and credit in the release notes if you'd like it.

## What counts

- Anything that could expose a person's data to someone other than them and the server they chose.
- Anything that makes the app contact a host other than the person's own server.
- Ways to make the app lose or corrupt saved data.
- Problems in the app's own native code (`app/modules/`) or patches (`app/patches/`).

Vulnerabilities in third-party packages that only affect the build tools (not the app on the phone) are better
reported as a normal issue.

## Supported versions

Only the latest release gets fixes. The in-app updater (GitHub builds) and F-Droid both deliver updates.
