#!/usr/bin/env python3
"""Read-only asset/brochure evidence discovery from the existing official P2 snapshot."""
import argparse,csv,gzip,hashlib,html,json,re,time
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse
from urllib.request import Request,urlopen
def candidates(page,body):
 class Tags(HTMLParser):
  def __init__(self):super().__init__();self.rows=[]
  def handle_starttag(self,tag,attrs):
   if tag in ("a","img"):self.rows.append(dict(attrs))
 parser=Tags();parser.feed(body.decode("utf-8","replace"))
 rows=[];seen=set()
 for attrs in parser.rows:
  for key in ("href","src","data-src"):
   raw=attrs.get(key) or "";url=urljoin(page["url"],raw)
   if not raw or urlparse(url).scheme!="https" or url in seen:continue
   kind="BROCHURE_CANDIDATE" if re.search(r"\.pdf(?:$|[?#])",url,re.I) else "IMAGE_CANDIDATE" if re.search(r"\.(?:png|jpe?g|webp|svg)(?:$|[?#])",url,re.I) else None
   if kind:
    seen.add(url);rows.append({"universe_id":page.get("universe_id"),"source_page":page["url"],"url":url,"kind":kind,"alt":attrs.get("alt"),"qa_state":"EXACT_MODEL_MARKET_VERSION_REVIEW_REQUIRED"})
 return rows
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--snapshot",required=True);ap.add_argument("--config",required=True);ap.add_argument("--pdf-limit",type=int,default=8);a=ap.parse_args()
 out=Path(a.snapshot);cfg=json.loads(Path(a.config).read_text());pages={p["url"]:p for p in cfg["pages"]}
 rows=[];accepted_hosts={urlparse(p["url"]).hostname for p in cfg["pages"]}|{s["host"] for s in cfg["sources"].values()}
 for m in json.loads((out/"fetch_manifest.json").read_text()):
  if m.get("status")==200 and m.get("file"):
   body=gzip.decompress((out/"raw"/m["file"]).read_bytes());rows.extend(candidates(pages[m["url"]],body))
 pdfs=[];seen=set()
 for row in rows:
  if row["kind"]!="BROCHURE_CANDIDATE" or row["url"] in seen or len(pdfs)>=a.pdf_limit:continue
  seen.add(row["url"]);r=dict(row,status="NOT_CAPTURED")
  if urlparse(row["url"]).hostname not in accepted_hosts:
   r["status"]="HOST_REVIEW_REQUIRED";pdfs.append(r);continue
  try:
   with urlopen(Request(row["url"],headers={"User-Agent":"CarIndexEvidence/1.0"}),timeout=45) as response:
    body=response.read(25*1024*1024+1)
   if len(body)>25*1024*1024:raise ValueError("brochure exceeds 25 MiB bound")
   if not body.startswith(b"%PDF"):raise ValueError("source is not PDF bytes")
   sha=hashlib.sha256(body).hexdigest();directory=out/"brochures";directory.mkdir(exist_ok=True)
   target=directory/(sha+".pdf");target.write_bytes(body)
   r.update(status="PDF_CAPTURED_REVIEW_REQUIRED",sha256=sha,bytes=len(body),file=str(target))
   try:
    from pypdf import PdfReader
    reader=PdfReader(target);text="\n".join(p.extract_text() or "" for p in reader.pages)
    (directory/(sha+".txt")).write_text(text);r.update(pages=len(reader.pages),text_chars=len(text),extraction_state="TEXT_EXTRACTED_NOT_FACT_ACCEPTED")
   except Exception as e:r["extraction_error"]=str(e)[:200]
  except Exception as e:r["error"]=str(e)[:200]
  pdfs.append(r);time.sleep(1)
 result={"state":"STAGED","authority":"NO_CANONICAL_PROMOTION","candidates":rows,"brochures":pdfs,
         "counts":{"asset_candidates":len(rows),"pdf_captured":sum(r["status"]=="PDF_CAPTURED_REVIEW_REQUIRED" for r in pdfs),
                   "exact_images_accepted":0,"brochures_accepted":0}}
 (out/"asset_evidence.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
 print(json.dumps(result["counts"]))
if __name__=="__main__":main()
