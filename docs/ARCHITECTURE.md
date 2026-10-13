Website, CMS and (later) Flutter apps call one Node.js API. The API is the only
writer to the commerce tables. The Python worker runs beside it and reads/writes
MySQL directly. See the technical document for the full design.
