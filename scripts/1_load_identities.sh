#!/bin/sh

RESPONSE=
get_address() {
  local port=$1
  printf "Fetching address for $port"
  RESPONSE=$(curl -s http://localhost:$port/v1/self -H 'accept: application/json' 2>&1)
  if [ $? -ne 0 ] ; then
    echo "\nError getting self address:"
    echo $RESPONSE
    exit 1
  fi
  RESPONSE=$(echo $RESPONSE | jq -r .address)
  printf ", got: $RESPONSE\n"
}

set_alias() {
  local port=$1
  local addr=$2
  local alias=$3
  echo Updating alias on port $port for address $addr to $alias
  RESPONSE=$(curl -s -X 'PUT' http://localhost:$port/v1/members/$addr \
    -H 'Content-Type: application/json' \
    -d "{\"alias\":\"$alias\"}")
  if [ $? -ne 0 ] ; then
    echo "Error setting alias on port $port for address $addr to $alias:"
    echo $RESPONSE
    exit 1
  fi
}

get_address 9000
heidi=${RESPONSE}
get_address 9010
emma=$RESPONSE
get_address 9020
reginald=$RESPONSE

# First persona (Heidi the Hydrogen Producer)
set_alias 9000 $heidi "Heidi"
set_alias 9000 $emma "Emma"
set_alias 9000 $reginald "Reginald"

# Second persona (Emma the Energy Producer)
set_alias 9010 $heidi "Heidi"
set_alias 9010 $emma "Emma"
set_alias 9010 $reginald "Reginald"

# Third persona (Reginald the Regulator)
set_alias 9020 $heidi "Heidi"
set_alias 9020 $emma "Emma"
set_alias 9020 $reginald "Reginald"
