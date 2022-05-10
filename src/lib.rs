use deno_bindgen::deno_bindgen;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::Method;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;

#[deno_bindgen]
pub struct Request {
  method: String,
  url: String,
  headers: Option<HashMap<String, String>>,
  timeout: Option<u64>,
  accept_invalid_certs: Option<bool>,
}

#[deno_bindgen]
pub struct Response {
  status: u16,
  body: Vec<u8>,
  headers: HashMap<String, String>,
}

#[deno_bindgen(non_blocking)]
fn fetch(req: Request) -> Response {
  let client = Client::builder()
    .timeout(Duration::from_millis(req.timeout.unwrap_or(5000_u64)))
    .danger_accept_invalid_certs(req.accept_invalid_certs.unwrap_or(false))
    .build()
    .unwrap();
  let mut req_headers = HeaderMap::new();
  match req.headers {
    Some(v) => {
      for (key, value) in v.iter() {
        req_headers.insert(
          HeaderName::from_str(key).unwrap(),
          HeaderValue::from_str(value).unwrap(),
        );
      }
    }
    None => {}
  }
  let mut target_resp = Response {
    status: 0,
    body: Vec::new(),
    headers: HashMap::new(),
  };
  let maybe_resp = client
    .request(Method::from_bytes(req.method.as_bytes()).unwrap(), req.url)
    .headers(req_headers)
    .send();
  match maybe_resp {
    Ok(res) => {
      let mut res_headers = HashMap::new();
      for (key, value) in res.headers().iter() {
        res_headers.insert(
          String::from(key.as_str()),
          String::from(value.to_str().unwrap()),
        );
      }
      target_resp = Response {
        status: res.status().as_u16(),
        body: res.bytes().unwrap().to_vec(),
        headers: res_headers,
      }
    }
    Err(_) => {}
  }
  target_resp
}
