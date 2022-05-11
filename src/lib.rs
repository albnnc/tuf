use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::ffi::CStr;
use std::ffi::CString;
use std::os::raw::c_char;
use std::ptr;
use std::str::FromStr;
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug)]
pub struct Request {
  method: String,
  url: String,
  headers: Option<HashMap<String, String>>,
  timeout: Option<u64>,
  accept_invalid_certs: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
  status: u16,
  body: Vec<u8>,
  headers: HashMap<String, String>,
}

fn parse_req(data: *const c_char) -> Result<Request, Box<dyn Error>> {
  unsafe {
    let c_str = CStr::from_ptr(data).to_str()?;
    let req: Request = serde_json::from_str(c_str)?;
    Ok(req)
  }
}

fn serialize_resp(resp: Response) -> Result<*const c_char, Box<dyn Error>> {
  let json = serde_json::to_string(&resp)?;
  let mut bytes = Vec::new();
  bytes.extend_from_slice(json.as_bytes());
  bytes.push(0);
  let c_string = CString::from_vec_with_nul(bytes)?;
  Ok(c_string.into_raw() as *const c_char)
}

fn fetch_wrapped(data: *const c_char) -> Result<*const c_char, Box<dyn Error>> {
  let req = parse_req(data)?;
  let client = Client::builder()
    .timeout(Duration::from_millis(req.timeout.unwrap_or(5000_u64)))
    .danger_accept_invalid_certs(req.accept_invalid_certs.unwrap_or(false))
    .build()?;
  let mut req_headers = HeaderMap::new();
  match req.headers {
    Some(v) => {
      for (key, value) in v.iter() {
        req_headers.insert(HeaderName::from_str(key)?, HeaderValue::from_str(value)?);
      }
    }
    None => {}
  }
  let resp = client
    .request(Method::from_bytes(req.method.as_bytes())?, req.url)
    .headers(req_headers)
    .send()?;
  let mut resp_headers = HashMap::new();
  for (key, value) in resp.headers().iter() {
    resp_headers.insert(String::from(key.as_str()), String::from(value.to_str()?));
  }
  let target_resp = Response {
    status: resp.status().as_u16(),
    body: resp.bytes()?.to_vec(),
    headers: resp_headers,
  };
  serialize_resp(target_resp)
}

#[no_mangle]
fn fetch(data: *const c_char) -> *const c_char {
  fetch_wrapped(data).unwrap_or(ptr::null())
}
