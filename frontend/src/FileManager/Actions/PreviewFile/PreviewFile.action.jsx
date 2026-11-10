import React, { useMemo, useState, useEffect } from "react";
import { getFileExtension } from "../../../utils/getFileExtension";
import Loader from "../../../components/Loader/Loader";
import { useSelection } from "../../../contexts/SelectionContext";
import Button from "../../../components/Button/Button";
import { MdOutlineFileDownload } from "react-icons/md";
import { useFileIcons } from "../../../hooks/useFileIcons";
import { FaRegFileAlt } from "react-icons/fa";
import { useTranslation } from "../../../contexts/TranslationProvider";
import "./PreviewFile.action.scss";
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { JsonViewer } from 'view-json-react';
import { getObjectSize } from '../../../utils/getObjectSize'

const imageExtensions = ["jpg", "jpeg", "png"]
const videoExtensions = ["mp4", "mov", "avi"]
const audioExtensions = ["mp3", "wav", "m4a"]
const iFrameExtensions = ["docx", "xlsx"]
const blobExtensions = ["txt", "json", "csv", "pdf", "json","md"] // extensions that must be downloaded and converted into blob
const contentExtensions = ["md", "json" ]  // blobExtensions whose blob is directly converted to content
const embedExtensions = ["txt", "csv", "pdf" ]  // extensions whose content will be dwnloaded via 'src'

const PreviewFileAction = ({ filePreviewPath, filePreviewComponent, fileDownloadConfig }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [content, setContent] = useState(undefined)
  const { selectedFiles } = useSelection()
  const fileIcons = useFileIcons(73)
  const extension = getFileExtension(selectedFiles[0].name)?.toLowerCase()
  // Both props are optional, so there may be no address at all. Building one
  // regardless put the string 'undefined' at the front of it, and a host served
  // from a single-page app answers that with its own index.html: the modal
  // showed a broken image and the host's log showed a request nobody made. A
  // host whose bytes sit behind a session cannot give a plain address and
  // passes filePreviewComponent instead, so this is an ordinary case.
  const base = fileDownloadConfig ? fileDownloadConfig.url : filePreviewPath
  const filePath = base ? `${base}${selectedFiles[0].path}` : undefined
  const t = useTranslation()

  useEffect(() => {
    if (!filePath) return
    if (blobExtensions.includes(extension) || contentExtensions.includes(extension)) {
      fetch(filePath, { method:'GET', ...(fileDownloadConfig?.headers? { headers:fileDownloadConfig.headers} : {}) })
        .then((res) => res.blob())
        .then((blob) => {
          if (contentExtensions.includes(extension)) {
            blob.text().then (t => setContent(t))
            return
          }
          if (blobExtensions.includes(extension)) {
            setContent(URL.createObjectURL(blob))
            return
          }
        })
        .catch((err) => console.error("Error downloading object:", err))
    }
  }, [filePath])

  // Custom file preview component
  const customPreview = useMemo(
    () => filePreviewComponent?.(selectedFiles[0]),
    [filePreviewComponent]
  )

  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  };

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  };

  const handleDownload = () => {
    window.location.href = filePath
  };

  if (React.isValidElement(customPreview)) {
    return customPreview
  }

  const showable = [
    ...imageExtensions,
    ...videoExtensions,
    ...audioExtensions,
    ...iFrameExtensions,
    ...blobExtensions,
  ].includes(extension)

  // Three ways a preview cannot be shown, and all three belong in the panel
  // written for it: the file is of a kind that cannot be displayed, nobody
  // gave an address to fetch it from, or fetching it failed.
  //
  // The last of those used to show nothing at all. The condition read
  // `hasError || (isUnknownKind && <div/>)`, and `true || x` is `true`, which
  // React draws as nothing -- so the one case the panel exists for was the one
  // case it never appeared in, leaving an empty modal.
  const unavailable = hasError || !showable || !filePath

  return (
    <section className={`file-previewer ${extension === "pdf" ? "pdf-previewer" : ""}`}>
      {unavailable && (
          <div className="preview-error">
            <span className="error-icon">{fileIcons[extension] ?? <FaRegFileAlt size={73} />}</span>
            <span className="error-msg">{t("previewUnavailable")}</span>
            <div className="file-info">
              <span className="file-name">{selectedFiles[0].name}</span>
              {selectedFiles[0].size && <span>-</span>}
              <span className="file-size">{getObjectSize(selectedFiles[0].size)}</span>
            </div>
            {/* Downloading is the same address as previewing, so there is
              * nothing to offer when there is no address. */}
            {filePath && (
              <Button onClick={handleDownload} padding="0.45rem .9rem">
                <div className="download-btn">
                  <MdOutlineFileDownload size={18} />
                  <span>{t("download")}</span>
                </div>
              </Button>
            )}
          </div>
        )}
      {!unavailable && imageExtensions.includes(extension) && (
        <>
          <Loader isLoading={isLoading} />
          <img
            src={filePath}
            alt="Preview Unavailable"
            className={`photo-popup-image ${isLoading ? "img-loading" : ""}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        </>
      )}
      {!unavailable && videoExtensions.includes(extension) && (
        <video src={filePath} className="video-preview" controls autoPlay />
      )}
      {!unavailable && audioExtensions.includes(extension) && (
        <audio src={filePath} controls autoPlay className="audio-preview" />
      )}
      {!unavailable && iFrameExtensions.includes(extension) && (
        <>
          <iframe
            src={filePath}
            onLoad={handleImageLoad}
            onError={handleImageError}
            frameBorder="0"
            className={`photo-popup-iframe ${isLoading ? "img-loading" : ""}`}
          ></iframe>
        </>
      )}
      {!unavailable && embedExtensions.includes(extension) && (
        <>
          <embed
            src={content}
            type={extension==='pdf'?"application/pdf" : extension==='txt'? "text/plain" : ''}
            style={{
              width: "100%",
              height: "100%",
              border: "none"
            }}
          />
        </>
      )}
      { !unavailable && extension==='md' && content &&
        <div style={{ all: "unset", display: "block", overflow:'auto', padding:0, margin:0 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      }
      { !unavailable && extension==='json' && content &&
        <JsonViewer data={JSON.parse(content)} expandLevel={0} style={{ display:"" }}/>
      }

    </section>
  )
}

export default PreviewFileAction
