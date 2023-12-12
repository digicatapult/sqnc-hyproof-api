#!/bin/sh

# Run script using 'source ./3_add_to_ledger.sh' or '. ./3_add_to_ledger.sh'
echo "Heidi the Hydrogen Producer sends the data to the shared ledger"

curl -s -X POST http://localhost:8000/v1/certificate/$heidi_local_id/initiation -H 'accept: application/json' -d '' | jq -r

echo "Checking status on ledger"

state=$(curl -s http://localhost:8000/v1/certificate/$heidi_local_id/initiation | jq -r '.[] | .state')

while [ "$state" != "finalised" ] 
do 
sleep 2
state=$(curl -s http://localhost:8000/v1/certificate/$heidi_local_id/initiation | jq -r '.[] | .state')
echo $state
done

curl -s http://localhost:8000/v1/certificate/$heidi_local_id/ | jq -r