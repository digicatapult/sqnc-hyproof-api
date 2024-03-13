## HyProof Basic Demo

This document walks through a basic command-line demo of certificate issuance and revocation using the HyProof API

---

## Basic Demo Prerequisites

In order to be able to reproduce the steps described in this document, you first need to have the three persona testnet operational using `docker-compose`.

Use the following command to build and run the 3-persona testnet from the root directory of `sqnc-hyproof-api`:

```sh
docker-compose -f docker-compose-3-persona.yml up --build -d
```

The 3-party demonstration creates 3 personas with different roles, given below. Their Swagger API endpoints can be accessed using:

`Heidi (the Hydrogen Producer)`:

  - [localhost:8000/swagger](http://localhost:8000/swagger/#/)

  - [localhost:9000/v1/swagger](http://localhost:9000/v1/swagger/#/)

`Emma (the Energy Provider)`:

  - [localhost:8010/swagger](http://localhost:8010/swagger/#/)

  - [localhost:9010/v1/swagger](http://localhost:9010/v1/swagger/#/)

`Reginald (the Regulator)`:

  - [localhost:8020/swagger](http://localhost:8020/swagger/#/)

  - [localhost:9020/v1/swagger](http://localhost:9020/v1/swagger/#/)

---

## Running the Demo

The `scripts` folder within the `sqnc-hyproof-api` project contains a series of shell scripts (numbered initially with `1` through `5`).

- `1_load_identities.sh`
- `2_initiate_token.sh`
- `3_add_to_ledger.sh`
- `4_add_eCO2.sh`
- `5_revoke_certificate.sh`

These shell scripts contain helpful command line responses to inform the audience during the demonstration.

First change to the `scripts` folder.

These scripts need to store and use local environment variables for correct operation, and therefore have to be run using `source ./<name_of_script>.sh` or `. ./<name_of_script>.sh`

### 1. Load identities

After checking that the distributed ledger has initialised correctly and is finalising blocks, run `. ./1_load_identities.sh`.

This will populate the identity services of each node with the correct aliases for `Heidi`, `Emma`, and `Reginald` for the remainder of the demo.

You may optionally run `clear` from the cli at this point to clear the screen.

### 2. Initiate the token

Adopting the role of `Heidi the Hydrogen Producer`, you will tell the audience that you are now loading your local database with data for the batch of hydrogen to be certified.

Run `. ./2_initiate_token.sh`

### 3. Add the token to the ledger

Now inform the audience that you are now sending some of this data to the shared ledger.

Run `. ./3_add_to_ledger.sh`

Tell the audience that you are also transmitting a separate packet of data to your contracted energy provider `Emma the Energy Owner` to allow her to complete the certification process.

### 4. Add eCO~2~ and finalise the certificate

Now adopting the role of `Emma the Energy Provider` inform the audience that you can see the `initialised` certificate on the shared ledger, and you have also recieved a separate packet of information about this hydrogen batch from `Heidi`.

This data packet contains:

- a `cryptographic commitment` to the content of this data
- the `start time` and `end time` of `Heidi's` hydrogen production
- the total `kWh` of electricity used by `Heidi`

You will first check that this additional private data matches against that which is publicly visible on the `ledger` using the `cryptographic commitment`, and then calculate the total amount of eCO~2~ to be added from:

- the `time window` data sent by `Heidi`
- the total `kWh` data sent by `Heidi`
- knowledge of your `carbon intensity` over that period

You will then add the eCO2 to the `initialised` certificate on the ledger and the final certificate will be `issued`.

Run `. ./4_add_eCO2.sh`


### 5. Revoke the certificate

Reginald the Regulator has identified a problem with this hydrogen certificate. The reasons for revocation are contained within the PDF document titled `Revocation_Reason.pdf`.

Inform the audience that Reginald will first upload the document explaining the grounds for revocation into the system, and then trigger the revocation of the certificate.

This revocation will then be finalised by the shared `ledger` so that both the reason and revocation are visible by all.

Run `. ./5_revoke_certificate.sh`

It is important to state that the system is designed like this to prevent revocation from happening without a reason first being given and indelibly linked to the certificate that it is revoking.