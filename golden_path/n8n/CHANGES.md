# n8n changes applied by patch_workflow.py

Source: `CarIndex_Workflow.json` (Drive export, updatedAt 2026-08-29). Output: `CarIndex_Workflow.golden.json`.

| Type | Node | Change |
|---|---|---|
| prompt | Content Creation | System prompt replaced with golden_path/prompts/buyer_check_content.md: structured Buyer Check JSON, 6 fixed slides, every number must be a sourced key_data entry, missing = null. Removed: carousel design fields, spec_facts "use general market knowledge" and competitor "best estimate" instructions, platform captions. temperature 0.7 -> 0.2. |
| prompt | Content Creation Fallback (Gemini) | Same prompt as primary (was a known-stale older prompt). |
| code | Build Image Candidates | Keeps only high-confidence OEM matches (model name in URL). |
| node+wire | Set No Image (new) | IF Vehicle Identified[false] and IF Has OEM Candidates[false] now go here instead of Nano Banana Fallback Image. No AI images on the golden path. |
| code | Parse AI Draft | Parses the Buyer Check JSON; builds imageRecord (url, provenance, vehicle, approval) from the OEM candidate; no image selection by the LLM. |
| code | Carousel Designer | Replaced the 9 hardcoded templates (fixed "only trim", "naturally aspirated", "5 seats", fixed 4-line citation list, JAC JS2 default titles) with the 6-slide Buyer Check renderer from golden_path/src/buyer_check_render.js. Missing facts render as "not in source". |
| wire | Parse AI Draft | Output now goes only to Carousel Designer. Disconnected (left in place): Build Video Scenes, Reel Script Designer, Build Competitor Image Queries, Merge Carousel Inputs. |
| node+wire | Download Rendered Slide (new) | Fetches each rendered PNG so QA can verify it exists, its size and dimensions. Replaces Aggregate Rendered Slides on the path. |
| code | Merge Slides Into Item | Builds the rendered-file list (filename, url, exists, bytes, width, height) from Parse AI Draft (was Merge Carousel Inputs). |
| node+wire | QA Gate (new) + IF QA Passed (new) | Runs golden_path/src/qa_gate.js. Pass -> Sheet + Notion + Telegram. Fail -> Log QA Failed -> Telegram QA Fail Alert. Replaces Merge Video + Carousel / IF Carousel Incomplete on the path. |
| node | Log QA Failed (new), Telegram QA Fail Alert (new) | Sheet row Status=QA-Failed with the failure list in Summary; Telegram alert lists each failure. |
| params | Append row in sheet | Adds SlideFiles and QA columns (must exist as Sheet headers), stores the structured JSON in AI Draft, drops VideoURL/PlatformCaptions. |
| node+wire | Split Slides For Telegram, Send Slide Preview, Build Approval Message (new); Send Telegram Approval (changed) | Telegram gets all 6 slides as previews (was slide 1 only), then one text message with story title, car, format, files, image credit, missing facts, sources, QA result, PostId and YES / NO <reason> instructions. Its message_id is stored on the Sheet row. Download Slide for Telegram is no longer on the path. |
| code | Extract Reply / Switch YES/NO | YES (or نعم/موافق) -> Approved; NO <reason> (or لا/رفض) -> Rejected with reason; anything else is ignored (previously any non-YES reply rejected the post). |
| params | Update Status: Rejected / Reply acks | Writes RejectReason column (must exist in the Sheet); acks echo the reason. No publishing. |
| wire | IF Relevant Enough -> Log Low Relevance Skip | False branch was unconnected, so low-relevance skips were never logged. |
| params | Editor-in-Chief Fallback (Claude) | Instruction role assistant -> system (fix from branch claude/carousel-designer-rules-nhvkom, missing from the Aug 29 export). |
