import React, { useEffect, useState } from "react";
import axios from "axios";
import { Upload, Progress } from "antd";
import { InboxOutlined } from "@ant-design/icons";

axios.defaults.baseURL = "http://localhost:4001";
const chunkSize = 1024 * 1024 * 5; //5MB section size, increase the number measure in mb

function App() {
  const [showProgress, setShowProgress] = useState(false);
  const [counter, setCounter] = useState(1);
  const [fileToBeUpload, setFileToBeUpload] = useState(null);
  const [beginingOfTheChunk, setBeginingOfTheChunk] = useState(0);
  const [endOfTheChunk, setEndOfTheChunk] = useState(chunkSize);
  const [progress, setProgress] = useState(0);
  const [fileGuid, setFileGuid] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    if (fileToBeUpload) {
      fileUpload();
    }
    if (progress === 100) setIsReset(true);
  }, [fileToBeUpload, progress]);

  useEffect(() => {
    if (isReset) {
      setTimeout(() => {
        resetChunkProperties();
        setIsReset(false);
      }, 500);
    }
  }, [isReset]);

  const getFileContext = ({ file }) => {
    // Total count of chunks will have been upload to finish the file
    const totalCount =
      file.size % chunkSize === 0
        ? file.size / chunkSize
        : Math.floor(file.size / chunkSize) + 1;

    setChunkCount(totalCount);

    setFileToBeUpload(file);
    setFileGuid(file.name);

    // show progress bar
    setShowProgress(true);
  };

  const fileUpload = () => {
    setCounter(counter + 1);
    if (counter <= chunkCount) {
      const chunk = fileToBeUpload.slice(beginingOfTheChunk, endOfTheChunk);
      const newItem = {
        chunk,
        hash: counter,
        fileName: fileGuid,
      };
      uploadChunk(newItem);
    }
  };

  const uploadChunk = async (chunk) => {
    let formData = new FormData();
    formData.append("filename", chunk.fileName);
    formData.append("hash", chunk.hash);
    formData.append("chunk", chunk.chunk);

    // Upload section
    await axios({
      method: "post",
      url: "/upload",
      data: formData,
    }).then(async ({ data }) => {
      if (data.isSuccess) {
        setBeginingOfTheChunk(endOfTheChunk);
        setEndOfTheChunk(endOfTheChunk + chunkSize);
        if (counter === chunkCount) {
          await uploadCompleted();
        } else {
          const percentage = (counter / chunkCount) * 100;
          setProgress(percentage);
        }
      } else {
        console.log("Error Occurred:", data.errorMessage);
      }
    });
  };

  const uploadCompleted = async () => {
    await axios({
      method: "get",
      url: "/merge",
      params: {
        filename: fileGuid,
      },
    }).then(({ data }) => {
      if (data.isSuccess) {
        setProgress(100);
      }
    });
  };

  const resetChunkProperties = () => {
    setShowProgress(false);
    setProgress(0);
    setCounter(1);
    setFileToBeUpload(null);
    setBeginingOfTheChunk(0);
    setEndOfTheChunk(chunkSize);
  };

  return (
    <div className="wrap">
      <Upload.Dragger
        accept=".csv"
        customRequest={getFileContext}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag file to this area to upload
        </p>
      </Upload.Dragger>
      {showProgress && <Progress percent={progress} />}
    </div>
  );
}

export default App;
