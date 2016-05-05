# Quarrying PlyQL using JSON-over-HTTP

Run `plyql` with the `--json-server 8083` option which indicates on which port you want plyql to listen.
                   
Example:
                                      
```bash
plyql -h your.druid.broker:8082 -i P2Y --json-server 8083
```


## Data requests

`POST /plyql`

Post with a JSON body that includes the following keys:

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


## Health check

`GET /health`

The health endpoint that just return 200 as long as the server is running.
It is useful if plyql is running behind a load balancer.

Example:

```bash
curl -X GET 'http://localhost:8083/health'  
```
