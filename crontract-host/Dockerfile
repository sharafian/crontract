from node:8
user root
run apt-get update && apt-get install -y python

# required because access to /usr is required to
# global install, but you must also be the node
# user to install build dependencies.
# TODO: is this safe?
run chmod a+rwx -R /usr

user node
run npm install -g ilp-curl
