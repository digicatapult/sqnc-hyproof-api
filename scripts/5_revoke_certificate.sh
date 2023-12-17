#!/bin/sh

# Run script using 'source ./5_revoke_certificate.sh' or '. ./5_revoke_certificate.sh'

reggie_response=$(curl -s -X 'GET' http://localhost:8020/v1/certificate -H 'accept: application/json')

export reggie_local_id=$(echo $reggie_response | jq -r '.[] | .id')

echo "Reginald the Regulator submits the documentation explaining the grounds for revocation"

file_id=$(curl -s -X 'POST' http://localhost:8020/v1/attachment \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@Revocation_Reason.pdf;type=application/pdf' | jq -r .id)

sleep 1

echo "Reginald the Regulator now revokes the certificate"

revoked_cert=$(curl -s -X 'POST' http://localhost:8020/v1/certificate/$reggie_local_id/revocation \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "reason": "'"$file_id"'"
}')

sleep 1 

echo "Waiting for certificate to be revoked on-chain"

state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id -H 'accept: application/json' | jq -r .state)

while [ "$state" != "revoked" ] 
do 
sleep 2
state=$(curl -s http://localhost:8010/v1/certificate/$emma_local_id -H 'accept: application/json' | jq -r .state)
echo $state
done

echo "The final certificate as seen by the Regulator"

curl -s http://localhost:8020/v1/certificate/$reggie_local_id -H 'accept: application/json' | jq -r