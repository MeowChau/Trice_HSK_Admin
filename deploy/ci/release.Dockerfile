FROM scratch
COPY . /release/
# The updater only creates this container and copies its files; it never runs it.
CMD ["/release-not-executable"]
