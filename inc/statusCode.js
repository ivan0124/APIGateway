

var HTTP_STATUS_CODE = {
  // Successful
  OK: 200,                              // ( Note: Success to handle this command )
  CREATED: 201,                         // ( Note: Resource was created )
  ACCEPTED: 202,                        // ( Note: Transient Status ( in setting ) )
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,                      // ( Note: Does not need to return an entity-body )

  // Redirect
  MULTIPLE_CHOICES: 300,

  // Reply Error
  BAD_REQUEST: 400,                     // ( Note: RESTful API syntax or format Error )   
  UNAUTHORIZED: 401,                    // ( Note: Need authorized )
  FORBIDDEN: 403,                       // ( Note: This resource is read or write only )
  NOT_FOUND: 404,                       // ( Note: Resource Not Found )
  METHOD_NOT_ALLOWED: 405,              // ( Note: only support GET, PUT, POST, DELETE )
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,                 // ( Note: WSN Setting Failed Timeout )
  CONFLICT: 409,
  GONE: 410,                            // ( Note: SenHub disconnect )
  UNSUPPORTED_MEDIA_TYPE: 415,          // ( Note: Not JSON Format )
  REQUESTED_RANGE_NOT_SATISFIABLE: 416, // ( Note: Set value range is out of range )
  SYNTAX_ERROR: 422,                    // ( Note: format is correct but syntax error )
  LOCKED: 426,                          // ( Note: This resource be setting now by another client )

  //Interal Error
  INTERNAL_SERVER_ERROR: 500,            // ( Note: Fail to Get / Set )
  NOT_IMPLEMENTED: 501,                  // ( Note: This version wsn driver can't support this command )
  SERVICE_UNABAILABLE: 503               // ( Note: System is busy )
}

// https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html

module.exports.STATUS_CODE = HTTP_STATUS_CODE;