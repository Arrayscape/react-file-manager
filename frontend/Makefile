# Release mechanics for @arrayscape/react-file-manager.
#
# The registry is not named here -- publishConfig in package.json routes the
# publish to GitHub Packages. This file only supplies the token, and only for
# the npm process that needs it:
#
#   NPM_GITHUB_TOKEN=$$(gh auth token) npm ...
#
# is a shell prefix assignment, so the token is set in that process's
# environment and nowhere else. Two things it deliberately is not:
#
#   $(shell gh auth token)        would run at parse time and leave the token
#                                 sitting in make's memory for the whole run.
#   env 'npm_config_...=TOKEN'    works too, but puts the token in argv where
#                                 ps can read it.
#
# `npm publish` runs prepublishOnly, which rebuilds dist/, so publish does not
# depend on build here.

TAG := arrayscape

.PHONY: all build pack publish clean

all: build

build:
	npm run build

# Exactly what `publish` would send, without sending it. Contacts no registry.
pack:
	npm publish --dry-run --tag $(TAG)

# npm refuses to publish a prerelease (1.5.6-arrayscape.1) without an explicit
# --tag, and refuses to overwrite a version that already exists -- so bump the
# version in package.json for every release.
publish:
	@test -z "$$(git status --porcelain .)" || \
		{ echo "refusing to publish: uncommitted changes here, so the artifact would not be reproducible"; exit 1; }
	NPM_GITHUB_TOKEN=$$(gh auth token) npm publish --tag $(TAG)

clean:
	rm -rf dist
