from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.request
import urllib.error
from urllib.parse import urlparse

EMAIL_REGEX = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'

PHONE_REGEXES = [
    r'\+\d{1,3}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{0,4}',
    r'\(\d{2,4}\)[\s\-]?\d{3,4}[\s\-]?\d{3,4}',
    r'\b\d{3}[\s\-]\d{3}[\s\-]\d{4}\b',
    r'\b0\d{9,10}\b',
]

EXCLUDED_EMAIL_SUBSTRINGS = [
    'noreply', 'mailer-daemon', 'postmaster', '@example', '@test', '@w3', '@schema'
]

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
)


class handler(BaseHTTPRequestHandler):

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send_json(self, status_code, payload):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_length) if content_length else b''

        try:
            data = json.loads(raw_body or b'{}')
            url = (data.get('url') or '').strip()
        except (json.JSONDecodeError, AttributeError):
            self._send_json(400, {"error": "Invalid JSON body"})
            return

        if not url or not self._is_valid_url(url):
            self._send_json(400, {"error": "Invalid or missing 'url' field"})
            return

        try:
            html = self._fetch_page(url)
        except urllib.error.HTTPError as e:
            self._send_json(400, {"error": f"Page returned HTTP {e.code}"})
            return
        except urllib.error.URLError as e:
            self._send_json(400, {"error": f"Failed to reach URL: {e.reason}"})
            return
        except Exception as e:
            self._send_json(400, {"error": f"Failed to fetch page: {str(e)}"})
            return

        emails = self._extract_emails(html)
        phones = self._extract_phones(html)

        self._send_json(200, {
            "url": url,
            "emails": emails,
            "phones": phones
        })

    def _is_valid_url(self, url):
        try:
            result = urlparse(url)
            return result.scheme in ('http', 'https') and bool(result.netloc)
        except ValueError:
            return False

    def _fetch_page(self, url):
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as response:
            charset = response.headers.get_content_charset() or 'utf-8'
            return response.read().decode(charset, errors='ignore')

    def _extract_emails(self, html):
        found = re.findall(EMAIL_REGEX, html)
        filtered = [
            e for e in found
            if not any(bad in e.lower() for bad in EXCLUDED_EMAIL_SUBSTRINGS)
        ]
        return list(dict.fromkeys(filtered))

    def _extract_phones(self, html):
        matches = []
        for pattern in PHONE_REGEXES:
            matches.extend(re.findall(pattern, html))

        cleaned = []
        for m in matches:
            digits_only = re.sub(r'\D', '', m)
            if 7 <= len(digits_only) <= 15:
                cleaned.append(m.strip())

        return list(dict.fromkeys(cleaned))
