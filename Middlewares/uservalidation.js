import joi from 'joi';
const Uservalidation = (req,res,next)=>{
const userSchema = joi.object({
  username: joi.string().min(3).max(30).required(), 
    email: joi.string().email().required(),
    password: joi.string().min(6).max(20).required(),
    // role: joi.string().valid('user', 'admin','teacher').required(),
     })
    const{error} = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message:"Bad request",error });
    }
         
   
    next(); 
}




// logine middleware logic
const loginautherouter = (req,res,next)=>{
const userSchema = joi.object({
  
    email: joi.string().email().required(),
    password: joi.string().min(6).max(20).required(),
    
     })
    const{error} = userSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ message:"Bad request",error });
    }
         
   
    next(); 
}
export {Uservalidation,loginautherouter} 