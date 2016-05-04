# Quarrying PlyQL using JSON-over-HTTP

Run `plyql` with the `--json-server 8083` option which indicates on which port you want plyql to listen.
                   
Example:
                                      
```bash
plyql -h your.druid.broker:8082 -i P2Y --experimental-mysql-gateway 3307
```

Make POST requests to `/plyql` with a JSON body that includes the following keys:

  * **sql** [string] the PlyQL query that you want to execute
  * *note: more options are being added*  
  
Example:
  
```bash
curl -X POST 'http://localhost:8083/plyql' \
  -H 'content-type: application/json' \
  -d '{
  "sql": "SELECT COUNT(*) FROM wikipedia WHERE \"2015-09-12T01\" <= __time AND __time < \"2015-09-12T02\""
}'
```
