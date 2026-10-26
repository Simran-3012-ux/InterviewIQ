import {getAllInterviewReports,generateInterviewReport,getInterviewReportById,generateResumePdf} from "../services/interview.api"
import {useContext} from "react"
import {InterviewContext} from "../interview.context"


export const useInterview = () => {
    
    const context = useContext(InterviewContext)

    if(!context){
        throw new Error("useInterview must be used within an InterviewProvider")
    }
       const {loading, setLoading, report, setReport, reports, setReports} = context
       const generateReport = async ({jobDescription, selfDescription, resumeFile}) => {
        setLoading(true)
        try{
            const response = await generateInterviewReport({ jobDescription,selfDescription, resumeFile})
            setReport(response.interviewReport)
            return response.interviewReport
        }catch(error){
            console.log(error)
            throw new Error(error.response?.data?.error || error.response?.data?.message || error.message)
        }finally {
            setLoading(false)
        }
       }

       const getReportById = async (interviewId) => {
        setLoading(true)
        try{
            const response = await getInterviewReportById(interviewId)
            setReport(response.interviewReport)
        }catch(error){
            console.log(error)
        }finally{
            setLoading(false)
        }
       }

       const getReports = async () => {
        setLoading(true)
        try{
            const response = await getAllInterviewReports()
            setReports(response.interviewReports)
        } catch(error){
            console.log(error)
        }finally{
            setLoading(false)
        }
       }
       // Doesn't touch the shared `loading` flag, so the report page stays visible while the PDF builds.
       const getResumePdf = async (interviewReportId) => {
        try{
            const pdfBlob = await generateResumePdf({ interviewReportId })

            // trigger a browser download of the PDF
            const url = window.URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }))
            const link = document.createElement("a")
            link.href = url
            link.download = `resume_${interviewReportId}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        }catch(error){
            console.log(error)
            // with responseType "blob", the error body is also a Blob, so read it as JSON
            let message = error.message
            const data = error.response?.data
            if(data instanceof Blob){
                try{
                    const parsed = JSON.parse(await data.text())
                    message = parsed.error || parsed.message || message
                }catch{ /* not JSON, keep default message */ }
            }
            throw new Error(message)
        }
       }

       return  {loading,report, reports, generateReport, getReportById, getReports, getResumePdf}
    }
