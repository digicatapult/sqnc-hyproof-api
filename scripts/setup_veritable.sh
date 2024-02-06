#!/bin/sh

# variable for passing results from functions
RESPONSE=

create_did() {
  local port=$1
  local method=$2
  local options=$3

  echo "Creating DID for type $method on port $port with options $options"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port/dids/create" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{ \"method\": \"$method\", \"options\": $options }" 2>&1
  )

  if [ $? -ne 0 ] ; then
    echo "Error creating DID"
    exit 1
  fi
  RESPONSE=$(echo $RESPONSE | jq -r .did )
  echo "Created $RESPONSE"
}

create_schema() {
  local port=$1
  local issuer_did=$2
  local schema_name=$3
  local schema_version=$3

  echo "Creating schema $schema_name:$schema_version on port $port to be issued by $issuer_did"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port/schemas" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{ \"attrNames\": [ \"companyName\" ], \"version\": \"$schema_version\", \"name\": \"$schema_name\", \"issuerId\": \"$issuer_did\" }" 2>&1
  )
  if [ $? -ne 0 ] ; then
    echo "Error creating schema"
    exit 1
  fi
  RESPONSE=$(echo $RESPONSE | jq -r .id )
  echo "Created schema $RESPONSE"
}

create_cred_def() {
  local port=$1
  local tag=$2
  local schema_did=$3
  local issuer_did=$3

  echo "Creating credential definiton $tag on port $port for schema $schema_did with issuer $issuer_did"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port/credential-definitions" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{ \"tag\": \"$tag\", \"schemaId\": \"$schema_did\", \"issuerId\": \"$issuer_did\" }" 2>&1
  )
  if [ $? -ne 0 ] ; then
    echo "Error creating credential definition"
    exit 1
  fi
  RESPONSE=$(echo $RESPONSE | jq -r .id )
  echo "Created credential definition $RESPONSE"
}

create_connection() {
  local port_a=$1
  local port_b=$2

  echo "Creating out-of-bound invite using $port_a"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port_a/oob/create-invitation" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d '{}' 2>&1
  )
  if [ $? -ne 0 ] ; then
    echo "Error creating out-of-band invitation"
    exit 1
  fi
  local invitation_url=$(echo $RESPONSE | jq -r .invitationUrl )
  local oob_id=$(echo $RESPONSE | jq -r .outOfBandRecord.id )

  echo "Accepting invite from $port_a using $port_b"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port_b/oob/receive-invitation-url" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{ \"invitationUrl\": \"$invitation_url\" }" 2>&1
  )
  if [ $? -ne 0 ] ; then
    echo "Error accepting out-of-band invitation"
    exit 1
  fi
  local connection_id=$(echo $RESPONSE | jq -r .connectionRecord.id )
  local connection_state=$(echo $RESPONSE | jq -r .connectionRecord.state )

  while [ "$connection_state" != "completed" ]
  do
    echo "Waiting for connection to complete, currently: $connection_state"
    RESPONSE=$(
      curl -s -X 'GET' \
        "http://localhost:$port_b/connections/$connection_id" \
        -H 'accept: application/json' 2>&1
    )
    if [ $? -ne 0 ] ; then
      echo "Error getting connection $connection_id"
      exit 1
    fi
    connection_state=$(echo $RESPONSE | jq -r .state )
    sleep 1
  done
  echo "Connection established ($port_b): $connection_id"
  RESPONSE=$(
    curl -s -X 'GET' \
      "http://localhost:$port_a/connections?outOfBandId=$oob_id" \
      -H 'accept: application/json'
  )
  if [ $? -ne 0 ] ; then
    echo "Error getting connections for $port_a"
    exit 1
  fi
  connection_id=$(echo $RESPONSE | jq -r '.[0].id')
  echo "Connection established ($port_a): $connection_id"
  RESPONSE=$connection_id
}

issue_credential() {
  local port_issuer=$1
  local port_holder=$2
  local connection_id=$3
  local cred_def_id=$4
  local company_name=$5

  echo "Offering credential from $port_issuer to $port_holder ($company_name)"
  RESPONSE=$(
    curl -s -X 'POST' \
      "http://localhost:$port_issuer/credentials/offer-credential" \
      -H 'accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{
      \"protocolVersion\": \"v2\",
      \"credentialFormats\": {
        \"anoncreds\": {
          \"credentialDefinitionId\": \"$cred_def_id\",
          \"attributes\": [
            {
              \"name\": \"companyName\",
              \"value\": \"$company_name\"
            }
          ],
          \"linkedAttachments\": []
        }
      },
      \"autoAcceptCredential\": \"always\",
      \"connectionId\": \"$connection_id\"
    }"
  )
  if [ $? -ne 0 ] ; then
    echo "Error issuing credential"
    exit 1
  fi
  local credential_state=$(echo $RESPONSE | jq -r .state )

  while [ "$credential_state" != "done" ]
  do
    echo "Waiting for credential issuence to be done: $credential_state"
    RESPONSE=$(
      curl -s -X 'GET' "http://localhost:$port_holder/credentials" -H 'accept: application/json'
    )
    if [ $? -ne 0 ] ; then
      echo "Error getting credentials for $port_holder"
      exit 1
    fi
    credential_state=$(echo $RESPONSE | jq -r  '.[0].state')
    sleep 1
  done
  echo "Credential issued"
}

create_did 10020 key '{ "keyType": "ed25519" }'
regulator_did=$RESPONSE

create_schema 10020 $regulator_did "hyproof-membership" "1.0.0"
schema_did=$RESPONSE

create_cred_def 10020 "hyproof-membership-reginald" $schema_did $regulator_did
cred_def_did=$RESPONSE

create_connection 10020 10000
conn_reginald_heidi=$RESPONSE

create_connection 10020 10010
conn_reginald_emma=$RESPONSE

create_connection 10010 10000
conn_heidi_emma=$RESPONSE

issue_credential 10020 10000 $conn_reginald_heidi $cred_def_did "Heidi"
issue_credential 10020 10010 $conn_reginald_emma $cred_def_did "Emma"
