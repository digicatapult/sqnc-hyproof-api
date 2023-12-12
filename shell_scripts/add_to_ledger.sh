#!/bin/sh

# Run script using 'source ./add_to_ledger.sh' or '. ./add_to_ledger.sh'

echo "Adding data to shared ledger"

sleep 1

curl -s -X POST http://localhost:8000/v1/certificate/$heidi_local_id/initiation -H 'accept: application/json' -d '' | jq -r

echo "Checking status on ledger"

state=$(curl -s http://localhost:8000/v1/certificate/$heidi_local_id/initiation | jq -r '.[] | .state')

while [ $state != "finalised" ] 
do 
sleep 2
state=$(curl -s http://localhost:8000/v1/certificate/$heidi_local_id/initiation | jq -r '.[] | .state')
echo $state
done

curl -s http://localhost:8000/v1/certificate/$heidi_local_id/initiation | jq -r '.[]'